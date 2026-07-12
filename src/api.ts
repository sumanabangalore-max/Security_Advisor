const getHeaders = () => {
  const token = localStorage.getItem("token");
  const aiEngine = localStorage.getItem("active_ai_engine") || "gemini";
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-AI-Engine": aiEngine,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  get: async <T>(endpoint: string): Promise<T> => {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(err.detail || `Request failed with status ${res.status}`);
    }
    return res.json();
  },

  post: async <T>(endpoint: string, body?: any): Promise<T> => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(err.detail || `Request failed with status ${res.status}`);
    }
    return res.json();
  },

  patch: async <T>(endpoint: string, body: any): Promise<T> => {
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(err.detail || `Request failed with status ${res.status}`);
    }
    return res.json();
  },

  delete: async <T>(endpoint: string): Promise<T> => {
    const res = await fetch(endpoint, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(err.detail || `Request failed with status ${res.status}`);
    }
    return res.json();
  },

  exportExcel: async (endpoint: string, body: any, filename: string): Promise<void> => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error("Failed to download spreadsheet report.");
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
};
