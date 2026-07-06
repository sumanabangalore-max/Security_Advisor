import React, { useState, useEffect, useRef } from "react";
import { Layers, UploadCloud, RefreshCw, FileText, CheckCircle2 } from "lucide-react";
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
          className={`group border border-dashed rounded-lg p-5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all ${isDragOver ? "border-emerald-500 bg-emerald-500/5" : "border-zinc-800 bg-zinc-950/20 hover:border-zinc-700 hover:bg-zinc-900/10"}`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,.csv,.xls,.xlsx"
            className="hidden"
          />
          <UploadCloud className={`h-8 w-8 transition-colors ${isDragOver ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-400"}`} />
          <div>
            <p className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">Upload Inventory File</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Drag & drop or click to upload .xls, .xlsx, .csv, or .json</p>
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
                <th className="px-4 py-3">Software Name</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Host / Address</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">CPE Name</th>
                <th className="px-4 py-3 text-center">Environment</th>
                <th className="px-4 py-3 text-center">Criticality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 text-xs text-zinc-300">
              {items.map((item) => (
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
    </div>
  );
}
