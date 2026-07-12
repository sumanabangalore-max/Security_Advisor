import React, { useState, useEffect, useRef } from "react";
import { Layers, UploadCloud, RefreshCw, FileText, CheckCircle2, Plus, X, ChevronUp, ChevronDown, Save } from "lucide-react";
import { api } from "../api";
import { InventoryItem } from "../types";

interface InventoryGridProps {
  userRole: "admin" | "analyst" | "viewer";
  refreshTrigger: number;
}

export default function InventoryGrid({ userRole, refreshTrigger }: InventoryGridProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ingestMsg, setIngestMsg] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canEdit = userRole === "admin" || userRole === "analyst";

  // Sorting states
  const [sortField, setSortField] = useState<keyof InventoryItem>("software_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Modal open state
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formSoftwareName, setFormSoftwareName] = useState("");
  const [formVersion, setFormVersion] = useState("");
  const [formEnvironment, setFormEnvironment] = useState("Production");
  const [formHostname, setFormHostname] = useState("");
  const [formIpAddress, setFormIpAddress] = useState("");
  const [formOwner, setFormOwner] = useState("");
  const [formCriticality, setFormCriticality] = useState("Medium");
  const [formCpeUri, setFormCpeUri] = useState("");

  // Lifecycle option toggle and fields
  const [includeLifecycle, setIncludeLifecycle] = useState(false);
  const [lifecycleStatus, setLifecycleStatus] = useState<"Supported" | "End of Support" | "End of Life">("Supported");
  const [eosDate, setEosDate] = useState("");
  const [eolDate, setEolDate] = useState("");
  const [sourceUrl, setSourceUrl] = useState("https://endoflife.io");
  const [sourceChecking, setSourceChecking] = useState("endoflife.io website");
  const [notes, setNotes] = useState("");

  const handleSort = (field: keyof InventoryItem) => {
    if (sortField === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedItems = React.useMemo(() => {
    const sorted = [...items];
    if (!sortField) return sorted;
    return sorted.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === undefined || valA === null) valA = "";
      if (valB === undefined || valB === null) valB = "";

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc" 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      } else {
        return sortOrder === "asc" 
          ? (valA > valB ? 1 : -1) 
          : (valB > valA ? 1 : -1);
      }
    });
  }, [items, sortField, sortOrder]);

  const renderSortHeader = (field: keyof InventoryItem, label: string) => {
    const isSorted = sortField === field;
    return (
      <th 
        onClick={() => handleSort(field)} 
        className="px-4 py-3 cursor-pointer hover:text-white transition-colors select-none"
      >
        <div className="flex items-center gap-1">
          <span>{label}</span>
          {isSorted ? (
            sortOrder === "asc" ? <ChevronUp className="h-3 w-3 text-emerald-400" /> : <ChevronDown className="h-3 w-3 text-emerald-400" />
          ) : (
            <ChevronDown className="h-3 w-3 text-zinc-600 opacity-40 group-hover:opacity-100" />
          )}
        </div>
      </th>
    );
  };

  const handleSubmitAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSoftwareName || !formVersion) {
      setError("Software Name and Version are required fields.");
      return;
    }

    setSubmitting(true);
    setError("");
    setIngestMsg("");
    try {
      const payload: any = {
        software_name: formSoftwareName,
        version: formVersion,
        environment: formEnvironment,
        hostname: formHostname,
        ip_address: formIpAddress,
        owner: formOwner,
        criticality: formCriticality,
        cpe_uri: formCpeUri
      };

      if (includeLifecycle) {
        payload.status = lifecycleStatus;
        payload.eos_date = eosDate || "N/A";
        payload.eol_date = eolDate || "N/A";
        payload.last_check_date = new Date().toISOString().split('T')[0];
        payload.source_url = sourceUrl;
        payload.source_checking = sourceChecking;
        payload.notes = notes;
      }

      await api.post("/api/v1/inventory", payload);
      setIngestMsg(`Successfully added asset "${formSoftwareName}" to inventory.`);
      setShowAddModal(false);
      
      // Clear form states
      setFormSoftwareName("");
      setFormVersion("");
      setFormHostname("");
      setFormIpAddress("");
      setFormOwner("");
      setFormCpeUri("");
      setIncludeLifecycle(false);

      // Reload
      await fetchInventory();
    } catch (err: any) {
      setError(err.message || "Failed to add single inventory asset to the database server.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [refreshTrigger]);

  const fetchInventory = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<InventoryItem[]>("/api/v1/inventory");
      setItems(data);
    } catch (err) {
      setError("Failed to fetch inventory records");
    } finally {
      setLoading(false);
    }
  };

  const handleIngest = async () => {
    if (!canEdit || loading) return;
    setLoading(true);
    setError("");
    setIngestMsg("");
    try {
      const res = await api.post<{ status: string; message: string }>("/api/v1/inventory/ingest");
      setIngestMsg(res.message);
      await fetchInventory();
    } catch (err) {
      setError("Manual inventory ingestion failed.");
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File) => {
    setLoading(true);
    setError("");
    setIngestMsg("");
    
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["json", "csv", "xls", "xlsx"].includes(ext || "")) {
      setError("Unsupported file format. Please upload a .xls, .xlsx, .csv, or .json file.");
      setLoading(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result as string;
        const base64Index = result.indexOf(";base64,");
        if (base64Index === -1) {
          throw new Error("Invalid file content formatting");
        }
        const base64 = result.substring(base64Index + 8);

        const res = await api.post<{ status: string; message: string }>("/api/v1/inventory/upload", {
          fileData: base64,
          fileName: file.name,
          fileType: ext
        });

        setIngestMsg(res.message);
        await fetchInventory();
      } catch (err: any) {
        setError(err.message || "Failed to process uploaded file on server.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (canEdit) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!canEdit) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  const getCriticalityBadge = (criticality?: string) => {
    const clean = (criticality || "medium").toLowerCase();
    switch (clean) {
      case "critical":
        return "bg-red-500/10 text-red-400 border border-red-500/30";
      case "high":
        return "bg-orange-500/10 text-orange-400 border border-orange-500/30";
      case "medium":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/30";
      default:
        return "bg-blue-500/10 text-blue-400 border border-blue-500/30";
    }
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-[#121214] p-5 space-y-4 shadow-md" id="inventory-grid">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded bg-emerald-600/10 p-1.5 text-emerald-400">
            <Layers className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Master CMDB Inventory</h3>
            <p className="text-[11px] text-zinc-500">Software systems and Configuration Items tracked for vulnerabilities</p>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-1.5 rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-[10px] font-bold text-white transition-all cursor-pointer uppercase tracking-wider shadow-sm shadow-emerald-950/20"
              id="add-inventory-single-btn"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Single Asset
            </button>
            <button
              id="ingest-inventory-btn"
              onClick={handleIngest}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-850 px-2.5 py-1.5 text-[10px] font-bold text-zinc-300 hover:text-white hover:bg-zinc-700 transition-all disabled:opacity-50 cursor-pointer uppercase tracking-wider"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Re-sync DB
            </button>
          </div>
        )}
      </div>

      {canEdit && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="group border border-dashed border-zinc-800 bg-zinc-950/20 hover:border-zinc-700 hover:bg-zinc-900/10 rounded-lg p-5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,.csv,.xls,.xlsx"
            className="hidden"
          />
          <UploadCloud className="h-8 w-8 text-zinc-550 group-hover:text-zinc-400 transition-colors" />
          <div>
            <p className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">Upload Inventory File</p>
            <p className="text-[10px] text-zinc-550 mt-0.5">Drag & drop or click to upload .xls, .xlsx, .csv, or .json</p>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-400 font-mono bg-red-500/5 p-2 rounded border border-red-500/15">{error}</p>}
      {ingestMsg && (
        <p className="text-xs text-emerald-400 font-mono bg-emerald-500/5 p-2 rounded border border-emerald-500/15 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {ingestMsg}
        </p>
      )}

      {loading && items.length === 0 ? (
        <div className="py-12 text-center text-xs text-zinc-500 font-mono">Loading inventory assets...</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-xs text-zinc-500 leading-relaxed border border-zinc-800 rounded bg-zinc-900/10">
          No configuration items found. Drag and drop an inventory spreadsheet to populate this dashboard.
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-zinc-800 bg-zinc-950/20">
          <table className="w-full text-left border-collapse" id="inventory-table">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/40 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {renderSortHeader("software_name", "Software Name")}
                {renderSortHeader("version", "Version")}
                {renderSortHeader("hostname", "Host / Address")}
                {renderSortHeader("owner", "Owner")}
                {renderSortHeader("cpe_uri", "CPE Name")}
                {renderSortHeader("environment", "Environment")}
                {renderSortHeader("criticality", "Criticality")}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 text-xs text-zinc-300">
              {sortedItems.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-900/30 transition-colors" id={`inventory-row-${item.id}`}>
                  <td className="px-4 py-3 font-semibold text-white">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-zinc-500" />
                      {item.software_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-zinc-400">{item.version}</td>
                  <td className="px-4 py-3">
                    <div className="text-zinc-300 font-medium">{item.hostname || "N/A"}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">{item.ip_address || "N/A"}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{item.owner || "Unassigned"}</td>
                  <td className="px-4 py-3 font-mono text-[9px] text-zinc-500 max-w-[150px] truncate" title={item.cpe_uri}>
                    {item.cpe_uri || "N/A"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase border ${item.environment.toLowerCase() === "production" ? "bg-red-500/10 text-red-400 border-red-500/20" : item.environment.toLowerCase() === "staging" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
                      {item.environment}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${getCriticalityBadge(item.criticality)}`}>
                      {item.criticality || "Medium"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Single Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4" id="add-asset-modal">
          <div className="w-full max-w-xl bg-[#121214] border border-zinc-800 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/40 p-4">
              <div className="flex items-center gap-2">
                <div className="rounded bg-emerald-600/10 p-1.5 text-emerald-400">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white uppercase tracking-wider">Add Single Inventory Asset</h3>
                  <p className="text-[10px] text-zinc-500 font-mono">Create a configuration item in the master database</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded p-1 text-zinc-550 hover:bg-zinc-850 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitAsset} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Software Name <span className="text-emerald-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apache Tomcat"
                    value={formSoftwareName}
                    onChange={(e) => setFormSoftwareName(e.target.value)}
                    className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-zinc-700 font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Active Version <span className="text-emerald-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9.0.52"
                    value={formVersion}
                    onChange={(e) => setFormVersion(e.target.value)}
                    className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white font-mono focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Environment</label>
                  <select
                    value={formEnvironment}
                    onChange={(e) => setFormEnvironment(e.target.value)}
                    className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-zinc-700 cursor-pointer"
                  >
                    <option value="Production">Production</option>
                    <option value="Staging">Staging</option>
                    <option value="Development">Development</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Criticality</label>
                  <select
                    value={formCriticality}
                    onChange={(e) => setFormCriticality(e.target.value)}
                    className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-zinc-700 cursor-pointer"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Hostname / Device</label>
                  <input
                    type="text"
                    placeholder="e.g. app-srv-01.internal"
                    value={formHostname}
                    onChange={(e) => setFormHostname(e.target.value)}
                    className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">IP Address</label>
                  <input
                    type="text"
                    placeholder="e.g. 10.140.0.12"
                    value={formIpAddress}
                    onChange={(e) => setFormIpAddress(e.target.value)}
                    className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white font-mono focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Owner / Custodian</label>
                  <input
                    type="text"
                    placeholder="e.g. Security Ops"
                    value={formOwner}
                    onChange={(e) => setFormOwner(e.target.value)}
                    className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Custom CPE Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. cpe:2.3:a:tomcat:9.0.52..."
                    value={formCpeUri}
                    onChange={(e) => setFormCpeUri(e.target.value)}
                    className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white font-mono focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>

              {/* Lifecycle Options Section */}
              <div className="border-t border-zinc-850 pt-4 mt-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeLifecycle}
                    onChange={(e) => setIncludeLifecycle(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-850 bg-zinc-900 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Specify Lifecycle (EOS/EOL) Dates Now</span>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Declare the vendor support lifecycle metrics immediately for this asset</p>
                  </div>
                </label>
              </div>

              {includeLifecycle && (
                <div className="space-y-4 bg-zinc-950/40 p-4 border border-zinc-850 rounded-lg animate-in fade-in duration-150">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Support Status</label>
                    <select
                      value={lifecycleStatus}
                      onChange={(e) => setLifecycleStatus(e.target.value as any)}
                      className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-zinc-700 cursor-pointer"
                    >
                      <option value="Supported">Supported</option>
                      <option value="End of Support">End of Support (EOS)</option>
                      <option value="End of Life">End of Life (EOL)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">End of Support (EOS) Date</label>
                      <input
                        type="text"
                        placeholder="YYYY-MM-DD or N/A"
                        value={eosDate}
                        onChange={(e) => setEosDate(e.target.value)}
                        className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white font-mono focus:outline-none focus:border-zinc-700"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">End of Life (EOL) Date</label>
                      <input
                        type="text"
                        placeholder="YYYY-MM-DD or N/A"
                        value={eolDate}
                        onChange={(e) => setEolDate(e.target.value)}
                        className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white font-mono focus:outline-none focus:border-zinc-700"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Check Website Source URL</label>
                      <input
                        type="text"
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Source of Checking</label>
                      <input
                        type="text"
                        value={sourceChecking}
                        onChange={(e) => setSourceChecking(e.target.value)}
                        placeholder="e.g. endoflife.io website, Production Support page"
                        className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Lifecycle Notes / Advisories</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Support matrix referenced via endoflife.io."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-zinc-700 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="flex items-center justify-end gap-3 border-t border-zinc-800/80 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded border border-zinc-800 bg-zinc-900 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-850 cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5 shadow-md shadow-emerald-950/20 cursor-pointer transition-colors"
                >
                  {submitting ? (
                    <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>ADD ASSET TO INVENTORY</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
