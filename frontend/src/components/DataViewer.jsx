import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { Loader2, Save, Eye, Search, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Play, Filter, EyeOff, RotateCcw, Download, Database } from 'lucide-react';

const DataViewer = ({ queryName, tabName }) => {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [columnTypes, setColumnTypes] = useState({});
  const [columnWidths, setColumnWidths] = useState({});
  const [paramsConfig, setParamsConfig] = useState({});
  const [paramValues, setParamValues] = useState({});
  const [hiddenColumns, setHiddenColumns] = useState(new Set());
  const [defaultColumns, setDefaultColumns] = useState([]);
  const [filters, setFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [pendingChanges, setPendingChanges] = useState({});
  const [loading, setLoading] = useState(true);
  const [fetchingData, setFetchingData] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState(null);

  const fetchData = async (overrideParams = null, resetState = false) => {
    if (resetState) {
      setColumns([]);
      setDefaultColumns([]);
      setHiddenColumns(new Set());
      setColumnTypes({});
      setParamsConfig({});
      setParamValues({});
      setPendingChanges({});
      setFilters({});
      setSortConfig({ key: null, direction: 'asc' });
    }

    setFetchingData(true);
    setError(null);
    
    const paramsToSend = overrideParams !== null ? overrideParams : (resetState ? {} : paramValues);
    
    try {
      const response = await axiosClient.post('/api/data/fetch', { 
        query_name: queryName,
        params: paramsToSend
      });
      
      const fetchedData = response.data.data || [];
      const fetchedTypes = response.data.column_types || {};
      const fetchedParams = response.data.parameters || {};
      
      setData(fetchedData);
      setColumnTypes(fetchedTypes);
      setParamsConfig(fetchedParams);

      // Cleanly initialize paramValues for only current query parameters
      const initialParamVals = {};
      Object.entries(fetchedParams).forEach(([key, meta]) => {
        initialParamVals[key] = meta.default !== undefined ? meta.default : '';
      });
      setParamValues(initialParamVals);

      if (fetchedData.length > 0) {
        const cols = Object.keys(fetchedData[0]);
        if (columns.length === 0) {
          setColumns(cols);
        }
        setDefaultColumns(cols);

        // Compute default width based on cell contents, stretching up to 1200px by default
        const autoWidths = {};
        cols.forEach(col => {
          let maxLen = col.length;
          fetchedData.forEach(row => {
            const val = row[col];
            if (val !== null && val !== undefined) {
              const len = String(val).length;
              if (len > maxLen) maxLen = len;
            }
          });
          const calculated = Math.min(1200, Math.max(140, maxLen * 9 + 50));
          autoWidths[col] = calculated;
        });

        setColumnWidths(prev => {
          const merged = { ...autoWidths };
          Object.keys(prev).forEach(k => {
            merged[k] = prev[k];
          });
          return merged;
        });
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
      setFetchingData(false);
    }
  };

  useEffect(() => {
    // Reset all query-specific state completely and fetch initial data on queryName change.
    // Deferred via setTimeout so setState calls don't run synchronously within the effect.
    const timer = setTimeout(() => {
      fetchData({}, true);
    }, 0);
    return () => clearTimeout(timer);
    // fetchData is intentionally omitted: it's recreated on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryName]);

  const getColType = (col) => {
    const rawType = columnTypes[col] || '';
    const lower = rawType.toLowerCase();
    
    if (lower.includes('bool')) return 'boolean';
    if (lower.includes('int') || lower.includes('serial')) return 'integer';
    if (lower.includes('float') || lower.includes('numeric') || lower.includes('decimal') || lower.includes('real') || lower.includes('double')) return 'float';
    if (lower.includes('date') || lower.includes('time')) return 'date';
    if (lower === 'url' || col.toLowerCase() === 'link' || col.toLowerCase().endsWith('_url')) return 'url';
    
    return 'text';
  };

  const handleParamChange = (paramKey, value) => {
    setParamValues(prev => ({ ...prev, [paramKey]: value }));
  };

  const handleParamSubmit = (e) => {
    e.preventDefault();
    fetchData(paramValues);
  };

  const handleFilterChange = (col, value) => {
    setFilters(prev => ({ ...prev, [col]: value }));
  };

  const handleSort = (col) => {
    setSortConfig(prev => {
      if (prev.key === col) {
        if (prev.direction === 'asc') {
          return { key: col, direction: 'desc' };
        } else if (prev.direction === 'desc') {
          return { key: null, direction: 'asc' };
        }
      }
      return { key: col, direction: 'asc' };
    });
  };

  const handleCellChange = (rowIndex, col, value) => {
    const colType = getColType(col);
    let sanitizedValue = value;

    if (colType === 'integer') {
      if (typeof value === 'string') {
        sanitizedValue = value.replace(/[^0-9-]/g, '');
        if (sanitizedValue !== '' && !isNaN(parseInt(sanitizedValue, 10))) {
          sanitizedValue = parseInt(sanitizedValue, 10);
        } else if (sanitizedValue === '') {
          sanitizedValue = null;
        }
      }
    } else if (colType === 'float') {
      if (typeof value === 'string') {
        sanitizedValue = value.replace(/[^0-9.-]/g, '');
        if (sanitizedValue !== '' && !isNaN(parseFloat(sanitizedValue))) {
          sanitizedValue = parseFloat(sanitizedValue);
        } else if (sanitizedValue === '') {
          sanitizedValue = null;
        }
      }
    }

    const newData = [...data];
    const originalRow = { ...newData[rowIndex] };
    newData[rowIndex] = { ...originalRow, [col]: sanitizedValue };
    setData(newData);

    setPendingChanges(prev => {
      const existing = prev[rowIndex] || { row_data: originalRow, updated_fields: {} };
      return {
        ...prev,
        [rowIndex]: {
          row_data: existing.row_data,
          updated_fields: {
            ...existing.updated_fields,
            [col]: sanitizedValue
          }
        }
      };
    });
  };

  const saveChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) return;
    
    setSaving(true);
    setError(null);
    try {
      const updates = Object.values(pendingChanges);
      await axiosClient.post('/api/data/update', {
        query_name: queryName,
        updates: updates
      });
      
      setPendingChanges({});
      await fetchData(); 
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const toggleColumn = (col) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  const handleDragStart = (e, col) => {
    setDraggedColumn(col);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, targetCol) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetCol) return;
    
    const newCols = [...columns];
    const dragIdx = newCols.indexOf(draggedColumn);
    const dropIdx = newCols.indexOf(targetCol);
    
    newCols.splice(dragIdx, 1);
    newCols.splice(dropIdx, 0, draggedColumn);
    setColumns(newCols);
    setDraggedColumn(null);
  };

  const resetColumns = () => {
    if (defaultColumns.length > 0) {
      setColumns(defaultColumns);
    }
    setHiddenColumns(new Set());
  };

  const canResetColumns = () => {
    if (hiddenColumns.size > 0) return true;
    if (defaultColumns.length > 0) {
      if (columns.length !== defaultColumns.length) return true;
      for (let i = 0; i < columns.length; i++) {
        if (columns[i] !== defaultColumns[i]) return true;
      }
    }
    return false;
  };

  // Column Resizing logic - allows stretching beyond 1200px if user desires!
  const handleResizeStart = (e, col) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startWidth = columnWidths[col] || 160;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(70, startWidth + deltaX);
      setColumnWidths(prev => ({ ...prev, [col]: newWidth }));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const calcCellHeight = (val, colWidth) => {
    if (val === null || val === undefined || val === '') return '36px';
    const text = String(val);
    if (!text.includes('\n') && text.length < 35) return '36px';
    
    // Estimate chars per line based on pixel column width (approx 8.5px per char)
    const availableWidth = Math.max(100, (colWidth || 160) - 24);
    const charsPerLine = Math.max(12, Math.floor(availableWidth / 8.5));
    
    const lines = text.split('\n');
    let totalVisualLines = 0;
    
    for (const line of lines) {
      if (line.length === 0) {
        totalVisualLines += 1;
      } else {
        totalVisualLines += Math.ceil(line.length / charsPerLine);
      }
    }
    
    // Calculate pixel height: ~20px line height + 16px padding, capped at 250px by default
    const pxHeight = Math.min(150, Math.max(36, totalVisualLines * 20 + 16));
    return `${pxHeight}px`;
  };

  const isUrlString = (val) => {
    if (typeof val !== 'string') return false;
    const trimmed = val.trim();
    return /^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed);
  };

  const formatUrl = (val) => {
    if (!val) return '';
    const trimmed = String(val).trim();
    if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
    return trimmed;
  };

  const filteredData = data.filter(row => {
    for (const [col, filterVal] of Object.entries(filters)) {
      if (filterVal) {
        const cellVal = String(row[col] ?? '').toLowerCase();
        if (!cellVal.includes(filterVal.toLowerCase())) {
          return false;
        }
      }
    }
    return true;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig.key) return 0;
    
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];

    if (valA === null || valA === undefined) valA = '';
    if (valB === null || valB === undefined) valB = '';

    const numA = Number(valA);
    const numB = Number(valB);
    let comparison;

    if (!isNaN(numA) && !isNaN(numB) && String(valA).trim() !== '' && String(valB).trim() !== '') {
      comparison = numA - numB;
    } else {
      comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
    }

    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  const visibleColumns = columns.filter(col => !hiddenColumns.has(col));
  const hasParameters = Object.keys(paramsConfig).length > 0;

  const exportToCSV = () => {
    if (sortedData.length === 0) return;

    const colsToExport = visibleColumns.length > 0 ? visibleColumns : columns;
    if (colsToExport.length === 0) return;

    // Header row
    const headerRow = colsToExport
      .map(col => `"${String(col).replace(/"/g, '""')}"`)
      .join(',');

    // Data rows
    const rows = sortedData.map(row => {
      return colsToExport
        .map(col => {
          const val = row[col];
          if (val === null || val === undefined) {
            return '""';
          }
          if (typeof val === 'boolean') {
            return val ? '"TRUE"' : '"FALSE"';
          }
          const str = String(val);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(',');
    });

    const csvContent = '\uFEFF' + [headerRow, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const safeTitle = (tabName || queryName || 'data')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/gi, '_')
      .replace(/^_+|_+$/g, '');
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `${safeTitle}_${dateStr}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            {tabName || queryName}
            {fetchingData && <Loader2 className="animate-spin text-primary" size={18} />}
          </h2>
          {!loading && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/25 shadow-sm">
              <Database size={12} className="text-primary" />
              <span>{data.length.toLocaleString()} {data.length === 1 ? 'row' : 'rows'}</span>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetColumns}
            disabled={!canResetColumns()}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border border-border/50
              ${canResetColumns() 
                ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80 cursor-pointer shadow-md' 
                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'}`}
          >
            <RotateCcw size={14} /> Reset Columns
          </button>

          <div className="relative group">
            <button className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md text-sm cursor-pointer hover:bg-secondary/80">
              <Eye size={16} /> Columns
            </button>
            <div className="absolute right-0 top-full mt-1 w-48 p-2 glass-card rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 max-h-64 overflow-y-auto border border-border/50">
              {columns.map(col => (
                <label key={col} className="flex items-center gap-2 p-1 text-sm hover:bg-secondary/50 rounded cursor-pointer text-gray-200">
                  <input 
                    type="checkbox" 
                    checked={!hiddenColumns.has(col)} 
                    onChange={() => toggleColumn(col)}
                    className="rounded border-gray-600 bg-gray-700"
                  />
                  {col}
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={exportToCSV}
            disabled={sortedData.length === 0}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border border-border/50
              ${sortedData.length > 0
                ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80 cursor-pointer shadow-md'
                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'}`}
            title={sortedData.length > 0 ? 'Export current table data to CSV' : 'No data available to export'}
          >
            <Download size={14} /> Export to CSV
          </button>
          
          <button 
            onClick={saveChanges}
            disabled={Object.keys(pendingChanges).length === 0 || saving}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-lg
              ${Object.keys(pendingChanges).length > 0 
                ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20 cursor-pointer' 
                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'}`}
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Save Changes {Object.keys(pendingChanges).length > 0 && `(${Object.keys(pendingChanges).length})`}
          </button>
        </div>
      </div>

      {/* Query Parameters Form (Rendered at top above the table) */}
      {hasParameters && (
        <form onSubmit={handleParamSubmit} className="glass-card p-4 rounded-xl border border-border/50 space-y-3 bg-secondary/20">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <Filter size={16} /> Query Parameters
            </h3>
            <span className="text-xs text-muted-foreground">Adjust parameters and click Run Query to update results</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {Object.entries(paramsConfig).map(([pKey, pMeta]) => {
              const pType = pMeta.type || 'string';
              const pLabel = pMeta.label || pKey.replace(/_/g, ' ');
              const curVal = paramValues[pKey] !== undefined ? paramValues[pKey] : (pMeta.default ?? '');

              return (
                <div key={pKey} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-300 capitalize">
                    {pLabel}
                  </label>
                  {pMeta.options && Array.isArray(pMeta.options) ? (
                    <select
                      value={curVal}
                      onChange={(e) => handleParamChange(pKey, e.target.value)}
                      className="bg-background/80 border border-border/60 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-primary"
                    >
                      {pMeta.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : pType === 'boolean' ? (
                    <div className="flex items-center h-[34px]">
                      <input
                        type="checkbox"
                        checked={curVal === true || curVal === 'true'}
                        onChange={(e) => handleParamChange(pKey, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary focus:ring-primary/50 cursor-pointer"
                      />
                    </div>
                  ) : (
                    <input
                      type={pType === 'integer' || pType === 'number' ? 'number' : pType === 'date' ? 'date' : 'text'}
                      value={curVal}
                      placeholder={pMeta.placeholder || ''}
                      onChange={(e) => handleParamChange(pKey, e.target.value)}
                      className="bg-background/80 border border-border/60 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-primary placeholder:text-muted-foreground/50 transition-all"
                    />
                  )}
                </div>
              );
            })}

            <div>
              <button
                type="submit"
                disabled={fetchingData}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 py-1.5 rounded text-xs transition-colors shadow-md shadow-primary/20 cursor-pointer"
              >
                {fetchingData ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
                Run Query
              </button>
            </div>
          </div>
        </form>
      )}

      {error && (
        <div className="glass-card border-destructive/50 bg-destructive/10 p-4 rounded-xl text-sm flex items-start gap-3">
           <div className="text-destructive mt-0.5">⚠️</div>
           <div className="text-destructive-foreground/90">{error}</div>
        </div>
      )}

      {loading && data.length === 0 ? (
        <div className="flex justify-center items-center h-64 glass-card rounded-xl">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <>
          {/* Row count summary bar directly above the table */}
          {!loading && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                  <span>Total rows from SQL search:</span>
                  <strong className="text-foreground font-semibold">{data.length.toLocaleString()}</strong>
                </span>
                {Object.values(filters).some(f => Boolean(f)) && filteredData.length !== data.length && (
                  <span className="text-accent font-medium">
                    (showing <strong className="text-foreground">{filteredData.length.toLocaleString()}</strong> matching column filters)
                  </span>
                )}
              </div>
              {Object.keys(pendingChanges).length > 0 && (
                <div className="text-amber-400 font-medium flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
                  {Object.keys(pendingChanges).length} unsaved {Object.keys(pendingChanges).length === 1 ? 'row edit' : 'row edits'}
                </div>
              )}
            </div>
          )}

          {/* Container max-height set to 650px with vertical and horizontal scrolling */}
          <div className="flex-1 overflow-auto max-h-[650px] rounded-xl border border-border/50 shadow-inner bg-card/10 glass-card">
          <table className="w-full text-sm text-left relative table-fixed border-collapse">
            <thead className="text-xs uppercase bg-secondary/40 text-muted-foreground sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                {visibleColumns.map((col) => {
                  const isSorted = sortConfig.key === col;
                  const colType = getColType(col);
                  const colWidth = columnWidths[col] || 160;

                  return (
                    <th 
                      key={col} 
                      style={{ width: `${colWidth}px`, minWidth: `${colWidth}px` }}
                      className="px-3 py-3 font-medium cursor-move select-none border-b border-r border-border/40 hover:bg-secondary/60 transition-colors relative group/header"
                      draggable
                      onDragStart={(e) => handleDragStart(e, col)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, col)}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-1">
                          <div className="truncate font-semibold text-gray-200 flex items-center gap-1" title={`${col.replace(/_/g, ' ')} (${colType})`}>
                            <span>{col.replace(/_/g, ' ')}</span>
                            <span className="text-[10px] text-muted-foreground/60 font-normal">({colType})</span>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleColumn(col);
                              }}
                              className="p-1 rounded hover:bg-secondary/80 text-muted-foreground/40 hover:text-destructive transition-colors cursor-pointer opacity-0 group-hover/header:opacity-100 transition-opacity"
                              title={`Hide column`}
                            >
                              <EyeOff size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSort(col);
                              }}
                              className={`p-1 rounded hover:bg-secondary/80 transition-colors cursor-pointer ${isSorted ? 'text-primary' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
                              title={`Sort by ${col}`}
                            >
                              {isSorted ? (
                                sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                              ) : (
                                <ArrowUpDown size={14} />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="relative flex items-center" onClick={(e) => e.stopPropagation()}>
                          <Search size={12} className="absolute left-2 text-muted-foreground/50" />
                          <input 
                            type="text" 
                            placeholder="Filter..."
                            value={filters[col] || ''}
                            onChange={(e) => handleFilterChange(col, e.target.value)}
                            className="w-full bg-background/50 border border-border/50 rounded px-6 py-1 text-xs focus:outline-none focus:border-primary/50 focus:bg-background text-gray-200 transition-all"
                          />
                        </div>
                      </div>
                      {/* Resizer Handle */}
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize select-none hover:bg-primary/70 transition-colors z-20"
                        onMouseDown={(e) => handleResizeStart(e, col)}
                        onClick={(e) => e.stopPropagation()}
                        title="Click and drag to resize column further"
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedData.length > 0 ? (
                sortedData.map((row) => {
                  const originalIndex = data.indexOf(row);
                  const hasPending = !!pendingChanges[originalIndex];
                  
                  return (
                    <tr key={originalIndex} className={`border-b border-border/30 hover:bg-secondary/20 transition-colors ${hasPending ? 'bg-primary/5' : ''}`}>
                      {visibleColumns.map((col) => {
                        const isId = col === 'id' || col.endsWith('_id');
                        const colType = getColType(col);
                        const rawValue = row[col];
                        const isModified = pendingChanges[originalIndex]?.updated_fields[col] !== undefined;
                        const colWidth = columnWidths[col] || 160;

                        return (
                          <td 
                            key={col} 
                            style={{ width: `${colWidth}px`, minWidth: `${colWidth}px` }}
                            className="px-2 py-1.5 border-r border-border/30 align-top whitespace-pre-wrap break-words relative group"
                          >
                            {colType === 'boolean' ? (
                              <div className="flex items-center justify-center py-1">
                                <input
                                  type="checkbox"
                                  checked={rawValue === true || rawValue === 'true' || rawValue === 't' || rawValue === 1}
                                  onChange={(e) => handleCellChange(originalIndex, col, e.target.checked)}
                                  disabled={isId}
                                  className={`w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary focus:ring-primary/50 cursor-pointer ${isModified ? 'accent-primary ring-2 ring-primary/40' : ''}`}
                                />
                              </div>
                            ) : (
                              <div className="flex items-start gap-1 w-full">
                                <textarea
                                  value={rawValue === null || rawValue === undefined ? '' : String(rawValue)}
                                  onChange={(e) => handleCellChange(originalIndex, col, e.target.value)}
                                  disabled={isId}
                                  style={{ height: calcCellHeight(rawValue, colWidth), maxHeight: '250px' }}
                                  className={`w-full bg-transparent px-2 py-1 rounded border border-transparent transition-all whitespace-pre-wrap break-words resize-y text-sm
                                    ${!isId && 'hover:border-border/50 focus:bg-background/90 focus:border-primary/50 group-hover:bg-background/30'} 
                                    ${isId && 'text-muted-foreground/60 cursor-not-allowed'}
                                    ${isModified ? 'text-primary font-medium bg-primary/10 border-primary/20' : 'text-gray-300'}`}
                                  title={isId ? "Primary keys cannot be edited directly" : ""}
                                />
                                {(colType === 'url' || isUrlString(rawValue)) && rawValue && (
                                  <a
                                    href={formatUrl(rawValue)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1.5 p-1 rounded text-primary hover:text-primary/80 hover:bg-primary/10 transition-colors shrink-0"
                                    title={`Open ${rawValue} in new tab`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-muted-foreground">
                    No matching data found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </>
      )}
    </div>
  );
};

export default DataViewer;
