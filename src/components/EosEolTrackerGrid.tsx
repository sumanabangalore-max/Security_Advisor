import React, { useState, useEffect } from "react";
import { Search, Calendar, ExternalLink, Edit2, Info, SlidersHorizontal, Save, X, Globe, CheckCircle, ChevronDown, ChevronUp, Download, Upload, FileSpreadsheet } from "lucide-react";
import { api } from "../api";
import { EosEolRecord } from "../types";

interface EosEolTrackerGridProps {
  userRole: "admin" | "analyst" | "viewer";
  refreshTrigger: number;
  onEosUpdated: () => void;
}

export default function EosEolTrackerGrid({ userRole, refreshTrigger, onEosUpdated }: EosEolTrackerGridProps) {
  const [records, setRecords] = useState<EosEolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [editingRecord, setEditingRecord] = useState<EosEolRecord | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sorting states
  const [sortField, setSortField] = useState<keyof EosEolRecord>("software_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // File upload drag states
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Edit form states
  const [editStatus, setEditStatus] = useState<"Supported" | "End of Support" | "End of Life">("Supported");
  const [editEosDate, setEditEosDate] = useState("");
  const [editEolDate, setEditEolDate] = useState("");
  const [editLastCheck, setEditLastCheck] = useState("");
  const [editSourceUrl, setEditSourceUrl] = useState("");
  const [editSourceChecking, setEditSourceChecking] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const canEdit = userRole === "admin" || userRole === "analyst";

  useEffect(() => {
    fetchRecords();
  }, [refreshTrigger]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const data = await api.get<EosEolRecord[]>("/api/v1/eos-eol");
      setRecords(data);
      setError("");
    } catch (err) {
      setError("Failed to fetch lifecycle registry details from database");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (rec: EosEolRecord) => {
    setEditingRecord(rec);
    setEditStatus(rec.status);
    setEditEosDate(rec.eos_date);
    setEditEolDate(rec.eol_date);
    setEditLastCheck(rec.last_check_date);
    setEditSourceUrl(rec.source_url);
    setEditSourceChecking(rec.source_checking || "endoflife.io / Vendor Page");
    setEditNotes(rec.notes || "");
    setSaveSuccess(false);
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !canEdit) return;

    setSaving(true);
    try {
      await api.post("/api/v1/eos-eol/override", {
        software_name: editingRecord.software_name,
        version: editingRecord.version,
        status: editStatus,
        eos_date: editEosDate,
        eol_date: editEolDate,
        last_check_date: editLastCheck,
        source_url: editSourceUrl,
        source_checking: editSourceChecking,
        notes: editNotes
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setEditingRecord(null);
        setSaveSuccess(false);
      }, 1000);

      // Refresh both local and global indicators
      fetchRecords();
      onEosUpdated();
    } catch (err) {
      setError("Failed to persist registry override in database server");
    } finally {
      setSaving(false);
    }
  };

  const handleSort = (field: keyof EosEolRecord) => {
    if (sortField === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleExportCSV = () => {
    // Generate CSV content
    const headers = [
      "Software Name",
      "Active Version",
      "Environment",
      "Lifecycle Status",
      "End of Support (EOS)",
      "End of Life (EOL)",
      "Last Checked Date",
      "Source of Checking",
      "Reference Source URL",
      "Notes"
    ];

    const rows = filteredRecords.map(rec => [
      `"${rec.software_name.replace(/"/g, '""')}"`,
      `"${rec.version.replace(/"/g, '""')}"`,
      `"${rec.environment.replace(/"/g, '""')}"`,
      `"${rec.status.replace(/"/g, '""')}"`,
      `"${rec.eos_date.replace(/"/g, '""')}"`,
      `"${rec.eol_date.replace(/"/g, '""')}"`,
      `"${rec.last_check_date.replace(/"/g, '""')}"`,
      `"${(rec.source_checking || "endoflife.io / Vendor Page").replace(/"/g, '""')}"`,
      `"${(rec.source_url || "").replace(/"/g, '""')}"`,
      `"${(rec.notes || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Application_Lifecycle_Registry_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadLifecycleCSV = async (file: File) => {
    setLoading(true);
    setError("");
    try {
      const text = await file.text();
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        throw new Error("File contains insufficient data lines.");
      }

      const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, "").toLowerCase());
      
      const softIdx = headers.findIndex(h => ["software name", "software", "name", "package", "software_name"].includes(h));
      const verIdx = headers.findIndex(h => ["version", "ver", "release"].includes(h));
      const statusIdx = headers.findIndex(h => ["status", "lifecycle status", "state"].includes(h));
      const eosIdx = headers.findIndex(h => ["eos_date", "eos date", "eos", "end of support"].includes(h));
      const eolIdx = headers.findIndex(h => ["eol_date", "eol date", "eol", "end of life"].includes(h));
      const sourceUrlIdx = headers.findIndex(h => ["source_url", "source url", "url", "source"].includes(h));
      const sourceCheckingIdx = headers.findIndex(h => ["source_checking", "source of checking", "check source", "source_checking"].includes(h));
      const notesIdx = headers.findIndex(h => ["notes", "notes/recommendations", "description"].includes(h));

      if (softIdx === -1 || verIdx === -1) {
        throw new Error("CSV must contain 'Software Name' and 'Version' columns.");
      }

      let successCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const matches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(",");
        const row = matches.map(cell => cell.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));

        const software_name = row[softIdx];
        const version = row[verIdx];
        if (!software_name || !version) continue;

        const status = statusIdx !== -1 && row[statusIdx] ? row[statusIdx] : "Supported";
        const eos_date = eosIdx !== -1 && row[eosIdx] ? row[eosIdx] : "N/A";
        const eol_date = eolIdx !== -1 && row[eolIdx] ? row[eolIdx] : "N/A";
        const source_url = sourceUrlIdx !== -1 && row[sourceUrlIdx] ? row[sourceUrlIdx] : "https://endoflife.io";
        const source_checking = sourceCheckingIdx !== -1 && row[sourceCheckingIdx] ? row[sourceCheckingIdx] : "endoflife.io website upload";
        const notes = notesIdx !== -1 && row[notesIdx] ? row[notesIdx] : "Ingested via lifecycle upload option.";

        await api.post("/api/v1/eos-eol/override", {
          software_name,
          version,
          status,
          eos_date,
          eol_date,
          last_check_date: new Date().toISOString().split('T')[0],
          source_url,
          notes,
          source_checking
        });
        successCount++;
      }

      fetchRecords();
      onEosUpdated();
      alert(`Ingested ${successCount} lifecycle override records successfully.`);
    } catch (err: any) {
      setError("Failed to parse and upload lifecycle file: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleUploadLifecycleCSV(file);
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
      await handleUploadLifecycleCSV(file);
    }
  };

  // Filters
  const filteredRecords = records.filter(rec => {
    const matchesSearch = 
      rec.software_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.version.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.environment.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      statusFilter === "ALL" || 
      rec.status.toUpperCase() === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const sortedRecords = React.useMemo(() => {
    const sorted = [...filteredRecords];
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
  }, [filteredRecords, sortField, sortOrder]);

  const renderSortHeader = (field: keyof EosEolRecord, label: string, align: "left" | "right" | "center" = "left") => {
    const isSorted = sortField === field;
    return (
      <th 
        onClick={() => handleSort(field)} 
        className={`py-3 px-4 cursor-pointer hover:text-white transition-colors select-none text-[10px] font-extrabold uppercase tracking-widest ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
      >
        <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"}`}>
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

  return (
    <div className="space-y-6" id="eos-eol-tracker-container">
      {/* Header and Filter Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-[#121214] p-5 border border-zinc-800 rounded-lg shadow-sm">
        <div className="space-y-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Application Lifecycle Registry (EOS/EOL)</h2>
          <p className="text-xs text-zinc-500">Track and manage vendor Support & End-Of-Life dates tied to the CMDB master inventory</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {["ALL", "SUPPORTED", "END OF SUPPORT", "END OF LIFE"].map((status) => {
              const isSelected = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase rounded border transition-all cursor-pointer ${
                    isSelected 
                      ? "bg-emerald-600/10 border-emerald-500 text-emerald-400 font-extrabold shadow-sm shadow-emerald-950/20" 
                      : "bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-850"
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-700 bg-zinc-850 hover:bg-zinc-800 text-[10px] text-zinc-300 hover:text-white font-bold uppercase tracking-wider transition-all cursor-pointer"
            title="Export Lifecycle Registry as CSV / Excel format"
          >
            <Download className="h-3.5 w-3.5" />
            Export Excel
          </button>
        </div>
      </div>

      {canEdit && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`group border border-dashed rounded-lg p-5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all ${isDragOver ? "border-emerald-500 bg-emerald-500/5" : "border-zinc-800 bg-zinc-950/20 hover:border-zinc-700 hover:bg-zinc-900/10"}`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,.json"
            className="hidden"
          />
          <Upload className={`h-8 w-8 transition-colors ${isDragOver ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-400"}`} />
          <div>
            <p className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">Upload Lifecycle Mappings</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Drag & drop or click to upload lifecycle CSV/spreadsheet</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950/20 border border-red-900/40 rounded text-xs text-red-400 font-mono flex items-start gap-2.5">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid View */}
      <div className="bg-[#121214] border border-zinc-800 rounded-lg shadow-md overflow-hidden">
        {/* Search Input Controls */}
        <div className="p-4 border-b border-zinc-800/60 bg-zinc-900/30 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by software name, version, environment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#161619] border border-zinc-850 rounded py-2 pl-9 pr-4 text-xs text-white placeholder-zinc-550 focus:outline-none focus:border-zinc-700 font-medium transition-colors"
            />
          </div>
          <div className="text-[10px] text-zinc-500 font-mono">
            Matched: <span className="text-zinc-300 font-bold">{sortedRecords.length}</span> / {records.length} assets
          </div>
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
            <p className="text-xs text-zinc-500 font-mono animate-pulse">Syncing application lifecycles...</p>
          </div>
        ) : sortedRecords.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <SlidersHorizontal className="h-8 w-8 text-zinc-700 mx-auto" />
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">No Lifecycle Records Found</h3>
            <p className="text-[11px] text-zinc-550 max-w-sm mx-auto">Try adjusting your search criteria or reset the CMDB inventory status</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900/55 border-b border-zinc-800/80 text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest">
                  {renderSortHeader("software_name", "Software Asset")}
                  {renderSortHeader("version", "Active Version")}
                  {renderSortHeader("environment", "Environment")}
                  {renderSortHeader("status", "Lifecycle Status")}
                  {renderSortHeader("eos_date", "End of Support (EOS)")}
                  {renderSortHeader("eol_date", "End of Life (EOL)")}
                  {renderSortHeader("last_check_date", "Last Checked")}
                  {renderSortHeader("source_checking", "Reference Source", "right")}
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/50">
                {sortedRecords.map((rec) => {
                  const isEol = rec.status === "End of Life";
                  const isEos = rec.status === "End of Support";
                  
                  return (
                    <tr key={rec.id} className="hover:bg-zinc-900/20 text-xs font-medium text-zinc-300 transition-colors">
                      <td className="py-4 px-4">
                        <div className="font-bold text-white text-xs">{rec.software_name}</div>
                      </td>
                      <td className="py-4 px-4 font-mono text-zinc-400 text-[11px]">v{rec.version}</td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center rounded-sm bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                          {rec.environment}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center rounded-sm px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border ${
                          isEol 
                            ? "bg-red-500/10 text-red-400 border-red-500/25" 
                            : isEos 
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/25" 
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                        }`}>
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono text-zinc-400 text-[11px]">{rec.eos_date}</td>
                      <td className="py-4 px-4 font-mono text-zinc-400 text-[11px]">{rec.eol_date}</td>
                      <td className="py-4 px-4 font-mono text-zinc-500 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 text-zinc-600" />
                          <span>{rec.last_check_date}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-mono text-zinc-450">{rec.source_checking || "endoflife.io / Vendor Page"}</span>
                          {rec.source_url ? (
                            <a
                              href={rec.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors text-[9px] uppercase font-bold tracking-wider hover:underline"
                            >
                              <Globe className="h-2.5 w-2.5" />
                              <span>View Website</span>
                              <ExternalLink className="h-2 w-2" />
                            </a>
                          ) : (
                            <span className="text-zinc-600 font-mono text-[10px]">N/A</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleOpenEdit(rec)}
                          id={`edit-eos-btn-${rec.id}`}
                          className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer inline-flex items-center justify-center border border-transparent hover:border-zinc-700"
                          title={canEdit ? "Edit Lifecycle Registry Override" : "View Lifecycle Registry Detail"}
                        >
                          {canEdit ? (
                            <Edit2 className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Info className="h-3.5 w-3.5 text-zinc-500" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Registry Modal Drawer */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4" id="edit-lifecycle-modal">
          <div className="w-full max-w-xl bg-[#121214] border border-zinc-800 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/40 p-4">
              <div className="flex items-center gap-2">
                <div className="rounded bg-emerald-600/10 p-1.5 text-emerald-400">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white uppercase tracking-wider">Vendor Lifecycle Registry</h3>
                  <p className="text-[10px] text-zinc-500 font-mono">Asset ID: {editingRecord.id} • {editingRecord.software_name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingRecord(null)}
                className="rounded p-1 text-zinc-550 hover:bg-zinc-850 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveOverride} className="p-5 space-y-4">
              {saveSuccess ? (
                <div className="p-8 text-center space-y-3">
                  <div className="inline-flex rounded-full bg-emerald-500/10 p-3 text-emerald-400">
                    <CheckCircle className="h-8 w-8 animate-bounce" />
                  </div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Registry Override Saved!</h3>
                  <p className="text-[11px] text-zinc-500">The software vendor lifecycle database has been updated successfully.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Software Name</label>
                      <input
                        type="text"
                        value={editingRecord.software_name}
                        disabled
                        className="w-full bg-zinc-900 border border-zinc-850 rounded p-2 text-xs text-zinc-500 font-semibold focus:outline-none cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Active Version</label>
                      <input
                        type="text"
                        value={editingRecord.version}
                        disabled
                        className="w-full bg-zinc-900 border border-zinc-850 rounded p-2 text-xs text-zinc-500 font-mono cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Support Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      disabled={!canEdit}
                      className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-zinc-700 cursor-pointer disabled:cursor-not-allowed disabled:text-zinc-550 disabled:bg-zinc-900"
                    >
                      <option value="Supported">Supported</option>
                      <option value="End of Support">End of Support (EOS)</option>
                      <option value="End of Life">End of Life (EOL)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">End of Support Date</label>
                      <input
                        type="text"
                        placeholder="YYYY-MM-DD or N/A"
                        value={editEosDate}
                        onChange={(e) => setEditEosDate(e.target.value)}
                        disabled={!canEdit}
                        className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white font-mono focus:outline-none focus:border-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-555 disabled:bg-zinc-900"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">End of Life Date</label>
                      <input
                        type="text"
                        placeholder="YYYY-MM-DD or N/A"
                        value={editEolDate}
                        onChange={(e) => setEditEolDate(e.target.value)}
                        disabled={!canEdit}
                        className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white font-mono focus:outline-none focus:border-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-555 disabled:bg-zinc-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Last Check Date</label>
                      <input
                        type="text"
                        placeholder="YYYY-MM-DD"
                        value={editLastCheck}
                        onChange={(e) => setEditLastCheck(e.target.value)}
                        disabled={!canEdit}
                        className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white font-mono focus:outline-none focus:border-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-555 disabled:bg-zinc-900"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Check Website Source URL</label>
                      <input
                        type="text"
                        placeholder="https://..."
                        value={editSourceUrl}
                        onChange={(e) => setEditSourceUrl(e.target.value)}
                        disabled={!canEdit}
                        className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-555 disabled:bg-zinc-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Source of Checking</label>
                      <input
                        type="text"
                        placeholder="e.g. endoflife.io website"
                        value={editSourceChecking}
                        onChange={(e) => setEditSourceChecking(e.target.value)}
                        disabled={!canEdit}
                        className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-555 disabled:bg-zinc-900"
                      />
                    </div>
                    <div className="space-y-1.5 text-zinc-550 flex flex-col justify-end text-[10px] pb-1.5">
                      <span className="font-semibold text-zinc-400">Checking Platforms:</span>
                      <span>• endoflife.io website</span>
                      <span>• Vendor Production Support Page</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Registry Notes / Recommendations</label>
                    <textarea
                      rows={3}
                      placeholder="Enter vendor advisories, recommended patch version targets, or internal mitigation logs..."
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      disabled={!canEdit}
                      className="w-full bg-[#161619] border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-555 disabled:bg-zinc-900 resize-none font-medium"
                    />
                  </div>

                  {/* Modal Footer Controls */}
                  <div className="flex items-center justify-end gap-3 border-t border-zinc-800/80 pt-4 mt-2">
                    <button
                      type="button"
                      onClick={() => setEditingRecord(null)}
                      className="rounded border border-zinc-800 bg-zinc-900 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-850 cursor-pointer"
                    >
                      {canEdit ? "CANCEL" : "CLOSE"}
                    </button>
                    {canEdit ? (
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5 shadow-md shadow-emerald-950/20 cursor-pointer transition-colors"
                      >
                        {saving ? (
                          <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        <span>SAVE REGISTRY OVERRIDE</span>
                      </button>
                    ) : (
                      <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest bg-zinc-900 px-3 py-2 rounded">Protected (Read-Only)</span>
                    )}
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
