import React, { useState, useEffect, useRef } from "react";
import { Layers, UploadCloud, RefreshCw, FileText, CheckCircle2, Plus, X, ChevronUp, ChevronDown, Save, Edit2, Trash2, Trash } from "lucide-react";
import { api } from "../api";
import { InventoryItem, UserRole } from "../types";

interface InventoryGridProps {
  userRole: UserRole;
  refreshTrigger: number;
  onInventoryUpdated?: () => void;
}

export default function InventoryGrid({ userRole, refreshTrigger, onInventoryUpdated }: InventoryGridProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ingestMsg, setIngestMsg] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canEdit = userRole === "admin" || userRole === "analyst" || userRole === "patch_manager" || userRole === "eos_manager" || userRole === "vuln_manager";

  // Sorting states
  const [sortField, setSortField] = useState<keyof InventoryItem>("software_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Modal open states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formSoftwareName, setFormSoftwareName] = useState("");
  const [formVersion, setFormVersion] = useState("");
  const [formEnvironment, setFormEnvironment] = useState("Production");
  const [formHostname, setFormHostname] = useState("");
  const [formIpAddress, setFormIpAddress] = useState("");
  const [formOwner, setFormOwner] = useState("");
  const [formPicEmail, setFormPicEmail] = useState("");
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

  // Column width state & resizing
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    software_name: 180,
    version: 100,
    environment: 110,
    hostname: 140,
    ip_address: 130,
    owner: 120,
    pic_email: 180,
    criticality: 110,
    status: 120,
    eol_date: 120
  });
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const [startX, setStartX] = useState<number>(0);
  const [startWidth, setStartWidth] = useState<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingCol) return;
      const diff = e.clientX - startX;
      const newWidth = Math.max(60, Math.min(450, startWidth + diff));
      setColumnWidths(prev => ({ ...prev, [resizingCol]: newWidth }));
    };
    const handleMouseUp = () => {
      if (resizingCol) setResizingCol(null);
    };
    if (resizingCol) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingCol, startX, startWidth]);

  const handleAutoFitColumn = (field: string) => {
    let maxLen = field.length;
    items.forEach(item => {
      const val = String((item as any)[field] ?? "");
      if (val.length > maxLen) maxLen = val.length;
    });
    const autoWidth = Math.max(90, Math.min(400, maxLen * 8.5 + 40));
    setColumnWidths(prev => ({ ...prev, [field]: autoWidth }));
  };

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
    const colWidth = columnWidths[field as string] || 130;

    const handleMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setResizingCol(field as string);
      setStartX(e.clientX);
      setStartWidth(colWidth);
    };

    return (
      <th 
        style={{ width: `${colWidth}px`, minWidth: '60px' }}
        onClick={() => handleSort(field)} 
        onDoubleClick={(e) => { e.stopPropagation(); handleAutoFitColumn(field as string); }}
        className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors select-none relative group border-r border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider"
        title="Click to sort, double-click to auto-fit width"
      >
        <div className="flex items-center justify-between gap-1 overflow-hidden">
          <span className="truncate">{label}</span>
          {isSorted ? (
            sortOrder === "asc" ? <ChevronUp className="h-3 w-3 text-indigo-600 shrink-0" /> : <ChevronDown className="h-3 w-3 text-indigo-600 shrink-0" />
          ) : (
            <ChevronDown className="h-3 w-3 text-slate-400 opacity-40 group-hover:opacity-100 shrink-0" />
          )}
        </div>

        <div
          onMouseDown={handleMouseDown}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => { e.stopPropagation(); e.preventDefault(); handleAutoFitColumn(field as string); }}
          className="absolute right-0 top-0 bottom-0 w-2.5 hover:bg-indigo-500/50 cursor-col-resize z-10 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to resize, double-click to auto-fit"
        />
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

    if (!formCpeUri.trim()) {
      setError("CPE Name (Common Platform Enumeration) is MANDATORY to fetch patches, vulnerabilities, and EOS/EOL notices.");
      setSubmitting(false);
      return;
    }

    try {
      const payload: any = {
        software_name: formSoftwareName,
        version: formVersion,
        environment: formEnvironment,
        hostname: formHostname,
        ip_address: formIpAddress,
        owner: formOwner,
        pic_email: formPicEmail,
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
      setFormPicEmail("");
      setFormCpeUri("");
      setIncludeLifecycle(false);

      // Reload
      await fetchInventory();
      onInventoryUpdated?.();
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

  const handleClearInventory = () => {
    if (!canEdit) return;
    setShowClearConfirm(true);
  };

  const confirmClearInventory = async () => {
    if (!canEdit) return;
    setLoading(true);
    setError("");
    setIngestMsg("");
    setShowClearConfirm(false);
    try {
      await api.post("/api/v1/inventory/clear");
      setIngestMsg("All inventory records cleared successfully.");
      await fetchInventory();
    } catch (err: any) {
      setError("Failed to clear inventory: " + (err.message || "Server error"));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAsset = (item: InventoryItem) => {
    if (!canEdit) return;
    setDeletingItem(item);
  };

  const confirmDeleteAsset = async () => {
    if (!deletingItem || !canEdit) return;
    try {
      await api.delete(`/api/v1/inventory/${deletingItem.id}`);
      setIngestMsg(`Deleted "${deletingItem.software_name}" from inventory.`);
      setDeletingItem(null);
      await fetchInventory();
    } catch (err: any) {
      setError("Failed to delete asset: " + (err.message || "Server error"));
      setDeletingItem(null);
    }
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormSoftwareName(item.software_name);
    setFormVersion(item.version);
    setFormEnvironment(item.environment || "Production");
    setFormHostname(item.hostname || "");
    setFormIpAddress(item.ip_address || "");
    setFormOwner(item.owner || "");
    setFormPicEmail(item.pic_email || "");
    setFormCriticality(item.criticality || "Medium");
    setFormCpeUri(item.cpe_uri || "");
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !canEdit) return;

    if (!formCpeUri.trim()) {
      setError("CPE Name (Common Platform Enumeration) is MANDATORY to fetch patches, vulnerabilities, and EOS/EOL notices.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await api.put(`/api/v1/inventory/${editingItem.id}`, {
        software_name: formSoftwareName,
        version: formVersion,
        environment: formEnvironment,
        hostname: formHostname,
        ip_address: formIpAddress,
        owner: formOwner,
        pic_email: formPicEmail,
        criticality: formCriticality,
        cpe_uri: formCpeUri
      });
      setIngestMsg(`Successfully updated asset "${formSoftwareName}".`);
      setEditingItem(null);
      await fetchInventory();
    } catch (err: any) {
      setError("Failed to update asset: " + (err.message || "Server error"));
    } finally {
      setSubmitting(false);
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-xs" id="inventory-grid">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 border border-emerald-100">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Master CMDB Inventory</h3>
            <p className="text-xs text-slate-500">Software systems and Configuration Items tracked for vulnerabilities</p>
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white transition-all cursor-pointer uppercase tracking-wider shadow-xs"
              id="add-inventory-single-btn"
            >
              <Plus className="h-4 w-4" />
              Add Single Asset
            </button>
            <button
              id="ingest-inventory-btn"
              onClick={handleIngest}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all disabled:opacity-50 cursor-pointer uppercase tracking-wider"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Re-sync DB
            </button>
            {items.length > 0 && (
              <button
                onClick={handleClearInventory}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 px-3 py-2 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer uppercase tracking-wider"
                title="Clear all default or existing inventory items"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-600" />
                Clear Inventory
              </button>
            )}
          </div>
        )}
      </div>

      {canEdit && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="group border-2 border-dashed border-slate-200 bg-slate-50/50 hover:border-emerald-500 hover:bg-emerald-50/20 rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,.csv,.xls,.xlsx"
            className="hidden"
          />
          <UploadCloud className="h-8 w-8 text-slate-400 group-hover:text-emerald-600 transition-colors" />
          <div>
            <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Upload Inventory File</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Drag & drop or click to upload .xls, .xlsx, .csv, or .json</p>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 font-mono bg-red-50 p-3 rounded-xl border border-red-200">{error}</p>}
      {ingestMsg && (
        <p className="text-xs text-emerald-700 font-mono bg-emerald-50 p-3 rounded-xl border border-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {ingestMsg}
        </p>
      )}

      {loading && items.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500 font-mono">Loading inventory assets...</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500 leading-relaxed border border-slate-200 rounded-xl bg-slate-50/50">
          No configuration items found. Drag and drop an inventory spreadsheet to populate this dashboard.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left border-collapse" id="inventory-table">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                {renderSortHeader("software_name", "Software Name")}
                {renderSortHeader("version", "Version")}
                {renderSortHeader("hostname", "Host / Address")}
                {renderSortHeader("owner", "Owner")}
                {renderSortHeader("pic_email", "PIC Email")}
                {renderSortHeader("cpe_uri", "CPE Name")}
                {renderSortHeader("environment", "Environment")}
                {renderSortHeader("criticality", "Criticality")}
                {canEdit && <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-600 uppercase tracking-widest">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
              {sortedItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors" id={`inventory-row-${item.id}`}>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      {item.software_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{item.version}</td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900 font-medium">{item.hostname || "N/A"}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{item.ip_address || "N/A"}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.owner || "Unassigned"}</td>
                  <td className="px-4 py-3 font-mono text-[11px]">
                    {item.pic_email ? (
                      <a 
                        href={`mailto:${item.pic_email}`} 
                        className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 font-mono text-[11px]"
                        title="Alert recipient for patches & vulnerabilities"
                      >
                        {item.pic_email}
                      </a>
                    ) : (
                      <span className="text-slate-400 italic font-sans text-[10px]">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-slate-500 max-w-[150px] truncate" title={item.cpe_uri}>
                    {item.cpe_uri || "N/A"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase border ${item.environment.toLowerCase() === "production" ? "bg-red-50 text-red-700 border-red-200" : item.environment.toLowerCase() === "staging" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                      {item.environment}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${getCriticalityBadge(item.criticality)}`}>
                      {item.criticality || "Medium"}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                          title="Edit Inventory Asset"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAsset(item)}
                          className="p-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all cursor-pointer"
                          title="Delete Inventory Asset"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Single Asset Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" id="edit-asset-modal">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 border border-indigo-100">
                  <Edit2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Edit Inventory Asset</h3>
                  <p className="text-[10px] text-slate-500 font-mono">Modify asset details for item #{editingItem.id}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-900 transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateAsset} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Software Name</label>
                  <input
                    type="text"
                    required
                    value={formSoftwareName}
                    onChange={(e) => setFormSoftwareName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Active Version</label>
                  <input
                    type="text"
                    required
                    value={formVersion}
                    onChange={(e) => setFormVersion(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Environment</label>
                  <select
                    value={formEnvironment}
                    onChange={(e) => setFormEnvironment(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="Production">Production</option>
                    <option value="Staging">Staging</option>
                    <option value="Development">Development</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Criticality</label>
                  <select
                    value={formCriticality}
                    onChange={(e) => setFormCriticality(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
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
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Hostname</label>
                  <input
                    type="text"
                    value={formHostname}
                    onChange={(e) => setFormHostname(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">IP Address</label>
                  <input
                    type="text"
                    value={formIpAddress}
                    onChange={(e) => setFormIpAddress(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Owner</label>
                  <input
                    type="text"
                    value={formOwner}
                    onChange={(e) => setFormOwner(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                    <span>PIC Email</span>
                    <span className="text-[9px] text-indigo-600 font-semibold uppercase">Alerts Target</span>
                  </label>
                  <input
                    type="email"
                    placeholder="pic.team@company.com"
                    value={formPicEmail}
                    onChange={(e) => setFormPicEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Common Platform Enumeration (CPE Name) <span className="text-red-600 font-bold">*</span></span>
                  <span className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Mandatory</span>
                </label>
                <input
                  type="text"
                  required
                  value={formCpeUri}
                  onChange={(e) => setFormCpeUri(e.target.value)}
                  placeholder="e.g. cpe:2.3:a:apache:http_server:2.4.48:*:*:*:*:*:*:*"
                  className="w-full bg-white border border-red-300 focus:border-emerald-500 rounded-lg p-2 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-500 italic">
                  Critical information: CPE identifier is mandatory to fetch security patches, vulnerabilities (CVEs), and EOS/EOL metrics.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-50 uppercase tracking-wider"
                >
                  <Save className="h-3.5 w-3.5" />
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Single Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" id="add-asset-modal">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 border border-emerald-100">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Add Single Inventory Asset</h3>
                  <p className="text-[10px] text-slate-500 font-mono">Create a configuration item in the master database</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-900 transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitAsset} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {error && (
                <div className="text-xs text-red-600 font-medium bg-red-50 p-3 rounded-lg border border-red-200">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Software Name <span className="text-emerald-600">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apache Tomcat"
                    value={formSoftwareName}
                    onChange={(e) => setFormSoftwareName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Active Version <span className="text-emerald-600">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9.0.52"
                    value={formVersion}
                    onChange={(e) => setFormVersion(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Environment</label>
                  <select
                    value={formEnvironment}
                    onChange={(e) => setFormEnvironment(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="Production">Production</option>
                    <option value="Staging">Staging</option>
                    <option value="Development">Development</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Criticality</label>
                  <select
                    value={formCriticality}
                    onChange={(e) => setFormCriticality(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
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
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Hostname / Device</label>
                  <input
                    type="text"
                    placeholder="e.g. app-srv-01.internal"
                    value={formHostname}
                    onChange={(e) => setFormHostname(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">IP Address</label>
                  <input
                    type="text"
                    placeholder="e.g. 10.140.0.12"
                    value={formIpAddress}
                    onChange={(e) => setFormIpAddress(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Owner / Custodian</label>
                  <input
                    type="text"
                    placeholder="e.g. Security Ops"
                    value={formOwner}
                    onChange={(e) => setFormOwner(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                    <span>PIC Email</span>
                    <span className="text-[9px] text-indigo-600 font-semibold uppercase">Alerts Target</span>
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. pic.team@company.com"
                    value={formPicEmail}
                    onChange={(e) => setFormPicEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>CPE Name (Common Platform Enumeration) <span className="text-red-600 font-bold">*</span></span>
                  <span className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Mandatory</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. cpe:2.3:a:apache:tomcat:9.0.52:*:*:*:*:*:*:*"
                  value={formCpeUri}
                  onChange={(e) => setFormCpeUri(e.target.value)}
                  className="w-full bg-white border border-red-300 focus:border-emerald-500 rounded-lg p-2 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-500 italic">
                  Critical information: CPE identifier is mandatory to fetch security patches, vulnerabilities (CVEs), and EOS/EOL notices.
                </p>
              </div>

              {/* Lifecycle Options Section */}
              <div className="border-t border-slate-100 pt-4 mt-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeLifecycle}
                    onChange={(e) => setIncludeLifecycle(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Specify Lifecycle (EOS/EOL) Dates Now</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Declare the vendor support lifecycle metrics immediately for this asset</p>
                  </div>
                </label>
              </div>

              {includeLifecycle && (
                <div className="space-y-4 bg-slate-50 p-4 border border-slate-200 rounded-xl animate-in fade-in duration-150">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Support Status</label>
                    <select
                      value={lifecycleStatus}
                      onChange={(e) => setLifecycleStatus(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="Supported">Supported</option>
                      <option value="End of Support">End of Support (EOS)</option>
                      <option value="End of Life">End of Life (EOL)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">End of Support (EOS) Date</label>
                      <input
                        type="text"
                        placeholder="YYYY-MM-DD or N/A"
                        value={eosDate}
                        onChange={(e) => setEosDate(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">End of Life (EOL) Date</label>
                      <input
                        type="text"
                        placeholder="YYYY-MM-DD or N/A"
                        value={eolDate}
                        onChange={(e) => setEolDate(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Check Website Source URL</label>
                      <input
                        type="text"
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Source of Checking</label>
                      <input
                        type="text"
                        value={sourceChecking}
                        onChange={(e) => setSourceChecking(e.target.value)}
                        placeholder="e.g. endoflife.io website, Production Support page"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Lifecycle Notes / Advisories</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Support matrix referenced via endoflife.io."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  {submitting ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
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

      {/* Delete Item Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" id="delete-asset-modal">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Delete Software Asset</h3>
                <p className="text-xs text-slate-500">Confirm permanent deletion from CMDB</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              Are you sure you want to remove <strong className="text-slate-900">{deletingItem.software_name}</strong> (v{deletingItem.version}) from inventory?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteAsset}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition-all cursor-pointer uppercase tracking-wider shadow-xs"
              >
                Yes, Delete Asset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Inventory Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" id="clear-inventory-modal">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100">
                <Trash className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Clear Master Inventory</h3>
                <p className="text-xs text-slate-500">Remove all current inventory records</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed bg-red-50/50 p-3 rounded-xl border border-red-200">
              Are you sure you want to clear <strong>all inventory records</strong>? This removes existing or default assets so you can import or build your custom infrastructure registry.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmClearInventory}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition-all cursor-pointer uppercase tracking-wider shadow-xs"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
