'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

type ProcessType = 'facturas' | 'liquidaciones' | 'arca' | 'proveedores' | 'ddjj' | 'conciliacion' | 'extractos' | 'payway' | 'bazar';

interface ExtractoRow {
  'Razón Social': string;
  'Banco': string;
  'Fecha': string;
  'Descripción': string;
  'Débito': number;
  'Crédito': number;
  'Leyenda / Referencia': string;
  'Saldo': number;
}

interface PaywayRow {
  'RAZON SOCIAL': string;
  'LOCAL': string;
  'FECHA DE VENTA': string;
  'TERMINAL': string;
  'MONTO BRUTO': number;
  'MONTO NETO': number;
  'TOTAL RET.': number;
  'RET IIBB': number;
  'TOTAL COM.': number;
  'COM. TOTAL': number;
  'IVA COM.': number;
  'PERCEP IVA': number;
}

export default function Home() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<ProcessType | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  // Para conciliación: archivos separados
  const [oppenFile, setOppenFile] = useState<File | null>(null);
  const [arcaConcilFile, setArcaConcilFile] = useState<File | null>(null);
  const [isDraggingOppen, setIsDraggingOppen] = useState(false);
  const [isDraggingArcaConcil, setIsDraggingArcaConcil] = useState(false);

  // Para extractos bancarios: dashboard con filtros
  const [extractosRows, setExtractosRows] = useState<ExtractoRow[]>([]);
  const [extractosFiltroEmpresa, setExtractosFiltroEmpresa] = useState<string>('all');
  const [extractosFiltroBanco, setExtractosFiltroBanco] = useState<string>('all');
  const [extractosFiltroFechaDesde, setExtractosFiltroFechaDesde] = useState<string>('');
  const [extractosFiltroFechaHasta, setExtractosFiltroFechaHasta] = useState<string>('');
  const [isExportingExtractos, setIsExportingExtractos] = useState(false);

  // Para Payway: dashboard con filtros
  const [paywayRows, setPaywayRows] = useState<PaywayRow[]>([]);
  const [paywayFiltroRazon, setPaywayFiltroRazon] = useState<string>('all');
  const [paywayFiltroLocal, setPaywayFiltroLocal] = useState<string>('all');
  const [paywayFiltroTerminal, setPaywayFiltroTerminal] = useState<string>('all');
  const [paywayFiltroFechaDesde, setPaywayFiltroFechaDesde] = useState<string>('');
  const [paywayFiltroFechaHasta, setPaywayFiltroFechaHasta] = useState<string>('');
  const [isExportingPayway, setIsExportingPayway] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => {
        if (selectedType === 'arca') {
          return file.name.endsWith('.csv') || file.type === 'text/csv';
        }
        if (selectedType === 'proveedores') {
          return file.type === 'application/pdf' || file.type.startsWith('image/');
        }
        if (selectedType === 'conciliacion') {
          return file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ||
                 file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                 file.type === 'application/vnd.ms-excel';
        }
        if (selectedType === 'liquidaciones') {
          return file.type === 'application/pdf' || file.name.endsWith('.zip') ||
                 file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
        }
        if (selectedType === 'extractos') {
          const lname = file.name.toLowerCase();
          return lname.endsWith('.csv') || lname.endsWith('.xls') || lname.endsWith('.xlsx');
        }
        if (selectedType === 'payway') {
          const lname = file.name.toLowerCase();
          return lname.endsWith('.xls') || lname.endsWith('.xlsx');
        }
        if (selectedType === 'bazar') {
          return file.type === 'application/pdf' || file.type.startsWith('image/');
        }
        return file.type === 'application/pdf';
      }
    );

    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles]);
    }
  }, [selectedType]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Handlers para conciliación - Oppen
  const handleDropOppen = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOppen(false);
    const file = Array.from(e.dataTransfer.files).find(
      f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    if (file) setOppenFile(file);
  }, []);

  const handleFileInputOppen = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setOppenFile(e.target.files[0]);
    }
  };

  // Handlers para conciliación - ARCA
  const handleDropArcaConcil = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingArcaConcil(false);
    const file = Array.from(e.dataTransfer.files).find(
      f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    if (file) setArcaConcilFile(file);
  }, []);

  const handleFileInputArcaConcil = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setArcaConcilFile(e.target.files[0]);
    }
  };

  const handleProcess = async () => {
    // Para conciliación, verificar archivos separados
    if (selectedType === 'conciliacion') {
      if (!oppenFile || !arcaConcilFile) return;
    } else {
      if (files.length === 0 || !selectedType) return;
    }

    setIsProcessing(true);
    setProcessedCount(0);

    // Todos los tipos usan descarga directa
    const apiEndpoint = selectedType === 'facturas' ? '/api/process-pdfs' :
                        selectedType === 'liquidaciones' ? '/api/process-liquidations' :
                        selectedType === 'ddjj' ? '/api/process-ddjj' :
                        selectedType === 'proveedores' ? '/api/process-proveedores' :
                        selectedType === 'conciliacion' ? '/api/conciliacion-fc' :
                        selectedType === 'extractos' ? '/api/process-extractos' :
                        selectedType === 'payway' ? '/api/process-payway' :
                        selectedType === 'bazar' ? '/api/process-bazar' :
                        '/api/process-arca';
    const downloadFilename = selectedType === 'facturas' ? 'facturas_procesadas.xlsx' :
                             selectedType === 'liquidaciones' ? 'liquidaciones_tarjetas.xlsx' :
                             selectedType === 'ddjj' ? 'ddjj_iva.xlsx' :
                             selectedType === 'proveedores' ? 'facturas_proveedores.xlsx' :
                             selectedType === 'conciliacion' ? 'Conciliacion_Final_Analizada.xlsx' :
                             selectedType === 'extractos' ? 'extractos_bancarios_consolidado.xlsx' :
                             selectedType === 'payway' ? 'payway_transferencias_consolidado.xlsx' :
                             selectedType === 'bazar' ? 'facturas_bazar_vajillas.xlsx' :
                             'comprobantes_arca_consolidados.xlsx';

    try {
      // Para liquidaciones, procesar en lotes de 5 archivos para evitar error 413
      if (selectedType === 'liquidaciones' && files.length > 5) {
        const BATCH_SIZE = 5;
        const allResults: any[] = [];

        for (let i = 0; i < files.length; i += BATCH_SIZE) {
          const batch = files.slice(i, i + BATCH_SIZE);
          const formData = new FormData();
          batch.forEach((file) => {
            formData.append('files', file);
          });

          const response = await fetch('/api/analyze-liquidations', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Error en lote ${Math.floor(i / BATCH_SIZE) + 1}`);
          }

          const data = await response.json();
          if (data.liquidations) {
            allResults.push(...data.liquidations);
          }

          setProcessedCount(Math.min(i + BATCH_SIZE, files.length));
        }

        // Generar Excel con todos los resultados
        const excelResponse = await fetch('/api/generate-liquidations-excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ liquidations: allResults }),
        });

        if (!excelResponse.ok) {
          throw new Error('Error generando Excel');
        }

        const blob = await excelResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadFilename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
      // Para proveedores, procesar en lotes de 3 archivos para evitar error 413
      else if (selectedType === 'proveedores' && files.length > 3) {
        const BATCH_SIZE = 3;
        const allResults: any[] = [];

        for (let i = 0; i < files.length; i += BATCH_SIZE) {
          const batch = files.slice(i, i + BATCH_SIZE);
          const formData = new FormData();
          batch.forEach((file) => {
            formData.append('files', file);
          });

          // Usar endpoint de análisis que devuelve JSON
          const response = await fetch('/api/analyze-proveedores', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Error en lote ${Math.floor(i / BATCH_SIZE) + 1}`);
          }

          const data = await response.json();
          if (data.invoices) {
            allResults.push(...data.invoices);
          }

          setProcessedCount(Math.min(i + BATCH_SIZE, files.length));
        }

        // Generar Excel con todos los resultados
        const excelResponse = await fetch('/api/generate-proveedores-excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoices: allResults }),
        });

        if (!excelResponse.ok) {
          throw new Error('Error generando Excel');
        }

        const blob = await excelResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadFilename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
      // Para bazar y vajillas, procesar en lotes de 3 archivos para evitar error 413
      else if (selectedType === 'bazar' && files.length > 3) {
        const BATCH_SIZE = 3;
        const allResults: any[] = [];

        for (let i = 0; i < files.length; i += BATCH_SIZE) {
          const batch = files.slice(i, i + BATCH_SIZE);
          const formData = new FormData();
          batch.forEach((file) => {
            formData.append('files', file);
          });

          const response = await fetch('/api/analyze-bazar', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Error en lote ${Math.floor(i / BATCH_SIZE) + 1}`);
          }

          const data = await response.json();
          if (data.invoices) {
            allResults.push(...data.invoices);
          }

          setProcessedCount(Math.min(i + BATCH_SIZE, files.length));
        }

        const excelResponse = await fetch('/api/generate-bazar-excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoices: allResults }),
        });

        if (!excelResponse.ok) {
          throw new Error('Error generando Excel');
        }

        const blob = await excelResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadFilename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else if (selectedType === 'conciliacion' && oppenFile && arcaConcilFile) {
        // Para conciliación, enviar los 2 archivos específicos
        const formData = new FormData();
        formData.append('files', oppenFile);
        formData.append('files', arcaConcilFile);

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Error processing files');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadFilename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        setProcessedCount(2);
        setTimeout(() => {
          setOppenFile(null);
          setArcaConcilFile(null);
          setProcessedCount(0);
        }, 3000);
        setIsProcessing(false);
        return;
      } else if (selectedType === 'extractos') {
        // Para extractos: el endpoint devuelve JSON con los movimientos
        // y mostramos un dashboard con filtros, totales y tabla
        const formData = new FormData();
        files.forEach((file) => {
          formData.append('files', file);
        });

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Error processing files');
        }

        const data = await response.json();
        setExtractosRows(data.rows || []);
        setExtractosFiltroEmpresa('all');
        setExtractosFiltroBanco('all');
        setExtractosFiltroFechaDesde('');
        setExtractosFiltroFechaHasta('');
        setProcessedCount(files.length);
        setFiles([]);
        setIsProcessing(false);
        return;
      } else if (selectedType === 'payway') {
        // Para Payway: el endpoint devuelve JSON con las transferencias
        // y mostramos un dashboard con filtros, totales y tabla
        const formData = new FormData();
        files.forEach((file) => {
          formData.append('files', file);
        });

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Error processing files');
        }

        const data = await response.json();
        setPaywayRows(data.rows || []);
        setPaywayFiltroRazon('all');
        setPaywayFiltroLocal('all');
        setPaywayFiltroTerminal('all');
        setPaywayFiltroFechaDesde('');
        setPaywayFiltroFechaHasta('');
        setProcessedCount(files.length);
        setFiles([]);
        setIsProcessing(false);
        return;
      } else {
        // Para otros tipos o pocos archivos, enviar todo junto
        const formData = new FormData();
        files.forEach((file) => {
          formData.append('files', file);
        });

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Error processing files');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadFilename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      setProcessedCount(files.length);
      setTimeout(() => {
        setFiles([]);
        setProcessedCount(0);
      }, 3000);
    } catch (error) {
      console.error('Error:', error);
      alert('Hubo un error al procesar los archivos. Por favor, intenta nuevamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetSelection = () => {
    setSelectedType(null);
    setFiles([]);
    setProcessedCount(0);
    setOppenFile(null);
    setArcaConcilFile(null);
    setExtractosRows([]);
    setExtractosFiltroEmpresa('all');
    setExtractosFiltroBanco('all');
    setExtractosFiltroFechaDesde('');
    setExtractosFiltroFechaHasta('');
    setPaywayRows([]);
    setPaywayFiltroRazon('all');
    setPaywayFiltroLocal('all');
    setPaywayFiltroTerminal('all');
    setPaywayFiltroFechaDesde('');
    setPaywayFiltroFechaHasta('');
  };

  // ===== Helpers para el dashboard de extractos =====

  // Convierte "dd-mm-yyyy" a "yyyy-mm-dd" para comparar / inputs date
  const fechaExtractoToISO = (f: string): string => {
    const m = f.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!m) return '';
    return `${m[3]}-${m[2]}-${m[1]}`;
  };

  const empresasExtractos = useMemo(() => {
    const set = new Set(extractosRows.map(r => r['Razón Social']).filter(Boolean));
    return Array.from(set).sort();
  }, [extractosRows]);

  const bancosExtractos = useMemo(() => {
    const set = new Set(extractosRows.map(r => r['Banco']).filter(Boolean));
    return Array.from(set).sort();
  }, [extractosRows]);

  const extractosFiltrados = useMemo(() => {
    return extractosRows.filter(r => {
      if (extractosFiltroEmpresa !== 'all' && r['Razón Social'] !== extractosFiltroEmpresa) return false;
      if (extractosFiltroBanco !== 'all' && r['Banco'] !== extractosFiltroBanco) return false;
      if (extractosFiltroFechaDesde || extractosFiltroFechaHasta) {
        const iso = fechaExtractoToISO(r['Fecha']);
        if (extractosFiltroFechaDesde && iso < extractosFiltroFechaDesde) return false;
        if (extractosFiltroFechaHasta && iso > extractosFiltroFechaHasta) return false;
      }
      return true;
    });
  }, [extractosRows, extractosFiltroEmpresa, extractosFiltroBanco, extractosFiltroFechaDesde, extractosFiltroFechaHasta]);

  const totalDebitosExtractos = useMemo(
    () => extractosFiltrados.reduce((acc, r) => acc + (Number(r['Débito']) || 0), 0),
    [extractosFiltrados]
  );

  const totalCreditosExtractos = useMemo(
    () => extractosFiltrados.reduce((acc, r) => acc + (Number(r['Crédito']) || 0), 0),
    [extractosFiltrados]
  );

  const formatMoney = (n: number) =>
    new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const limpiarFiltrosExtractos = () => {
    setExtractosFiltroEmpresa('all');
    setExtractosFiltroBanco('all');
    setExtractosFiltroFechaDesde('');
    setExtractosFiltroFechaHasta('');
  };

  // ===== Helpers para el dashboard de Payway =====

  // Convierte "dd/mm/yyyy" a "yyyy-mm-dd"
  const fechaPaywayToISO = (f: string): string => {
    const m = f.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return '';
    return `${m[3]}-${m[2]}-${m[1]}`;
  };

  const razonesPayway = useMemo(() => {
    const set = new Set(paywayRows.map(r => r['RAZON SOCIAL']).filter(v => v && v !== '-'));
    return Array.from(set).sort();
  }, [paywayRows]);

  const localesPayway = useMemo(() => {
    const set = new Set(paywayRows.map(r => r['LOCAL']).filter(v => v && v !== '-'));
    return Array.from(set).sort();
  }, [paywayRows]);

  const terminalesPayway = useMemo(() => {
    const set = new Set(paywayRows.map(r => r['TERMINAL']).filter(Boolean));
    return Array.from(set).sort();
  }, [paywayRows]);

  const paywayFiltrados = useMemo(() => {
    return paywayRows.filter(r => {
      if (paywayFiltroRazon !== 'all' && r['RAZON SOCIAL'] !== paywayFiltroRazon) return false;
      if (paywayFiltroLocal !== 'all' && r['LOCAL'] !== paywayFiltroLocal) return false;
      if (paywayFiltroTerminal !== 'all' && r['TERMINAL'] !== paywayFiltroTerminal) return false;
      if (paywayFiltroFechaDesde || paywayFiltroFechaHasta) {
        const iso = fechaPaywayToISO(r['FECHA DE VENTA']);
        if (paywayFiltroFechaDesde && iso < paywayFiltroFechaDesde) return false;
        if (paywayFiltroFechaHasta && iso > paywayFiltroFechaHasta) return false;
      }
      return true;
    });
  }, [paywayRows, paywayFiltroRazon, paywayFiltroLocal, paywayFiltroTerminal, paywayFiltroFechaDesde, paywayFiltroFechaHasta]);

  const totalBrutoPayway = useMemo(
    () => paywayFiltrados.reduce((acc, r) => acc + (Number(r['MONTO BRUTO']) || 0), 0),
    [paywayFiltrados]
  );
  const totalRetPayway = useMemo(
    () => paywayFiltrados.reduce((acc, r) => acc + (Number(r['TOTAL RET.']) || 0), 0),
    [paywayFiltrados]
  );
  const totalComPayway = useMemo(
    () => paywayFiltrados.reduce((acc, r) => acc + (Number(r['TOTAL COM.']) || 0), 0),
    [paywayFiltrados]
  );
  const totalNetoPayway = useMemo(
    () => paywayFiltrados.reduce((acc, r) => acc + (Number(r['MONTO NETO']) || 0), 0),
    [paywayFiltrados]
  );

  const formatMoneyPayway = (n: number) =>
    '$' + new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const limpiarFiltrosPayway = () => {
    setPaywayFiltroRazon('all');
    setPaywayFiltroLocal('all');
    setPaywayFiltroTerminal('all');
    setPaywayFiltroFechaDesde('');
    setPaywayFiltroFechaHasta('');
  };

  const exportarPaywayExcel = async () => {
    if (paywayFiltrados.length === 0) return;
    setIsExportingPayway(true);
    try {
      const response = await fetch('/api/generate-payway-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: paywayFiltrados }),
      });
      if (!response.ok) {
        throw new Error('Error generando Excel');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'payway_transferencias_consolidado.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
      alert('Hubo un error al exportar el Excel.');
    } finally {
      setIsExportingPayway(false);
    }
  };

  const exportarExtractosExcel = async () => {
    if (extractosFiltrados.length === 0) return;
    setIsExportingExtractos(true);
    try {
      const response = await fetch('/api/generate-extractos-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: extractosFiltrados }),
      });
      if (!response.ok) {
        throw new Error('Error generando Excel');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'extractos_bancarios_consolidado.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
      alert('Hubo un error al exportar el Excel.');
    } finally {
      setIsExportingExtractos(false);
    }
  };

  return (
    <main className="min-h-screen p-8 md:p-24">
      <div className="max-w-6xl mx-auto">
        {/* Logout Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar Sesión
          </button>
        </div>

        <div className="text-center mb-12">
          <div className="inline-block mb-4">
            <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary shadow-lg">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Herramientas de Gestión y Desarrollo
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Procesa tus documentos PDF y obtén Excel organizado en segundos
          </p>
        </div>

        {!selectedType ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-6">
            <button
              onClick={() => setSelectedType('facturas')}
              className="group relative p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-primary"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                  Desglose Facturas Arca
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Extrae datos de facturas y notas de crédito AFIP
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  <p>✓ Tipo de comprobante</p>
                  <p>✓ Fecha de emisión</p>
                  <p>✓ Razón social y CUIT</p>
                  <p>✓ Importes e IVA</p>
                  <p>✓ CAE y vencimiento</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setSelectedType('liquidaciones')}
              className="group relative p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-secondary"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-accent/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                  Liquidaciones de Tarjetas
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Extrae datos de liquidaciones VISA, Mastercard, Cabal
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  <p>✓ Fecha de emisión</p>
                  <p>✓ Pagador y establecimiento</p>
                  <p>✓ Total presentado y descuentos</p>
                  <p>✓ IVA y retenciones</p>
                  <p>✓ Detección de marca</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setSelectedType('arca')}
              className="group relative p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-green-500"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                  Bot ARCA
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Consolida CSVs descargados de AFIP
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  <p>✓ Comprobantes emitidos</p>
                  <p>✓ Comprobantes recibidos</p>
                  <p>✓ Consolidación automática</p>
                  <p>✓ Múltiples contribuyentes</p>
                  <p>✓ Formato estandarizado</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setSelectedType('proveedores')}
              className="group relative p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-orange-500"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                  Desglose Facturas Proveedores
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Extrae datos de facturas con IA (Azure + Gemini)
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  <p>✓ Coca-Cola FEMSA (18 campos)</p>
                  <p>✓ Quilmes (21 campos)</p>
                  <p>✓ Extractor general (Azure)</p>
                  <p>✓ Normalización de productos</p>
                  <p>✓ Soporta PDF e imágenes</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setSelectedType('ddjj')}
              className="group relative p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-pink-500"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-rose-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-pink-400 to-rose-600 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                  Extractor Declaración Jurada
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Extrae datos de DDJJ IVA AFIP
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  <p>✓ CUIT y Razón Social</p>
                  <p>✓ Débito y Crédito Fiscal</p>
                  <p>✓ Saldos técnicos</p>
                  <p>✓ Retenciones y percepciones</p>
                  <p>✓ Exporta a Excel</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setSelectedType('conciliacion')}
              className="group relative p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-cyan-500"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-teal-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-400 to-teal-600 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                  Conciliación FC Compra
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Concilia facturas Oppen vs ARCA
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  <p>✓ Matcheo por ID compuesto</p>
                  <p>✓ Diagnóstico de errores</p>
                  <p>✓ Filtro de proveedores</p>
                  <p>✓ Detección de faltantes</p>
                  <p>✓ Excel con formato</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setSelectedType('extractos')}
              className="group relative p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-indigo-500"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-violet-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h18M3 6h18M3 14h18M3 18h18"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                  Extractos Bancarios
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Consolida extractos de múltiples bancos
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  <p>✓ Ciudad, Galicia, Santander</p>
                  <p>✓ Provincia y Nación</p>
                  <p>✓ Detección automática</p>
                  <p>✓ Razón social desde nombre</p>
                  <p>✓ CSV, XLS y XLSX</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setSelectedType('payway')}
              className="group relative p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-fuchsia-500"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 to-pink-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-fuchsia-400 to-pink-600 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                  Transferencias de Payway
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Consolida exports de Payway en un solo Excel
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  <p>✓ Múltiples razones sociales</p>
                  <p>✓ Filtra Aprobadas y Devueltas</p>
                  <p>✓ Suma RET IIBB por jurisdicción</p>
                  <p>✓ Mantiene formato Payway oficial</p>
                  <p>✓ Acepta XLS y XLSX</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setSelectedType('bazar')}
              className="group relative p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-amber-700"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-amber-700/10 to-yellow-600/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-600 to-yellow-700 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                  Extracción Bazar y Vajillas
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Desglosa facturas de bazar/vajillas con IA (Gemini)
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  <p>✓ Razón social emisor y cliente</p>
                  <p>✓ Tipo de comprobante (A/B/C, NC, ND)</p>
                  <p>✓ Número, fecha, neto, IVA y total</p>
                  <p>✓ Procesamiento por lotes</p>
                  <p>✓ Soporta PDF e imágenes</p>
                </div>
              </div>
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${selectedType === 'facturas' ? 'bg-gradient-to-br from-blue-400 to-blue-600' : selectedType === 'liquidaciones' ? 'bg-gradient-to-br from-purple-400 to-purple-600' : selectedType === 'proveedores' ? 'bg-gradient-to-br from-orange-400 to-amber-600' : selectedType === 'ddjj' ? 'bg-gradient-to-br from-pink-400 to-rose-600' : selectedType === 'conciliacion' ? 'bg-gradient-to-br from-cyan-400 to-teal-600' : selectedType === 'extractos' ? 'bg-gradient-to-br from-indigo-400 to-indigo-600' : selectedType === 'payway' ? 'bg-gradient-to-br from-fuchsia-400 to-pink-600' : selectedType === 'bazar' ? 'bg-gradient-to-br from-amber-600 to-yellow-700' : 'bg-gradient-to-br from-green-400 to-emerald-600'} flex items-center justify-center`}>
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {selectedType === 'facturas' ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    ) : selectedType === 'liquidaciones' ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    )}
                  </svg>
                </div>
                <h2 className="text-2xl font-bold">
                  {selectedType === 'facturas' ? 'Desglose Facturas Arca' : selectedType === 'liquidaciones' ? 'Liquidaciones de Tarjetas' : selectedType === 'proveedores' ? 'Desglose Facturas Proveedores' : selectedType === 'ddjj' ? 'Extractor Declaración Jurada' : selectedType === 'conciliacion' ? 'Conciliación FC Compra' : selectedType === 'extractos' ? 'Extractos Bancarios' : selectedType === 'payway' ? 'Transferencias de Payway' : selectedType === 'bazar' ? 'Extracción Bazar y Vajillas' : 'Bot ARCA'}
                </h2>
              </div>
              <button
                onClick={resetSelection}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 font-medium transition-colors"
              >
                ← Volver a opciones
              </button>
            </div>

            {selectedType === 'payway' && paywayRows.length > 0 ? (
              /* Dashboard de transferencias Payway con totales, filtros y tabla */
              <div className="space-y-6">
                {/* Botones acción */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
                  <button
                    onClick={exportarPaywayExcel}
                    disabled={isExportingPayway || paywayFiltrados.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExportingPayway ? (
                      <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    )}
                    Exportar Reporte
                  </button>
                  <button
                    onClick={limpiarFiltrosPayway}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                    </svg>
                    Limpiar
                  </button>
                  <button
                    onClick={() => {
                      setPaywayRows([]);
                      limpiarFiltrosPayway();
                    }}
                    className="ml-auto inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Subir nuevos archivos →
                  </button>
                </div>

                {/* Totales */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                    <p className="text-sm uppercase tracking-wider text-gray-400 mb-2">Bruto Total</p>
                    <p className="text-2xl xl:text-3xl font-bold text-white font-mono">
                      {formatMoneyPayway(totalBrutoPayway)}
                    </p>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                    <p className="text-sm uppercase tracking-wider text-gray-400 mb-2">Total Retenciones</p>
                    <p className="text-2xl xl:text-3xl font-bold text-red-400 font-mono">
                      {formatMoneyPayway(totalRetPayway)}
                    </p>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                    <p className="text-sm uppercase tracking-wider text-gray-400 mb-2">Total Comisiones</p>
                    <p className="text-2xl xl:text-3xl font-bold text-orange-400 font-mono">
                      {formatMoneyPayway(totalComPayway)}
                    </p>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                    <p className="text-sm uppercase tracking-wider text-gray-400 mb-2">Neto Estimado</p>
                    <p className="text-2xl xl:text-3xl font-bold text-purple-400 font-mono">
                      {formatMoneyPayway(totalNetoPayway)}
                    </p>
                  </div>
                </div>

                {/* Filtros */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-gray-300 font-medium uppercase tracking-wider text-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      Filtros
                    </div>
                    {razonesPayway.length > 0 && (
                      <select
                        value={paywayFiltroRazon}
                        onChange={(e) => setPaywayFiltroRazon(e.target.value)}
                        className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="all">Todas las Razones Sociales</option>
                        {razonesPayway.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    )}
                    {localesPayway.length > 0 && (
                      <select
                        value={paywayFiltroLocal}
                        onChange={(e) => setPaywayFiltroLocal(e.target.value)}
                        className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="all">Todos los Locales</option>
                        {localesPayway.map(l => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    )}
                    <select
                      value={paywayFiltroTerminal}
                      onChange={(e) => setPaywayFiltroTerminal(e.target.value)}
                      className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="all">Todas las Terminales</option>
                      {terminalesPayway.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={paywayFiltroFechaDesde}
                      onChange={(e) => setPaywayFiltroFechaDesde(e.target.value)}
                      className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      title="Desde"
                    />
                    <input
                      type="date"
                      value={paywayFiltroFechaHasta}
                      onChange={(e) => setPaywayFiltroFechaHasta(e.target.value)}
                      className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      title="Hasta"
                    />
                    <span className="ml-auto italic text-gray-400 text-sm">
                      Viendo <strong className="text-white">{paywayFiltrados.length}</strong> de{' '}
                      <strong className="text-white">{paywayRows.length}</strong> transferencias
                    </span>
                  </div>
                </div>

                {/* Tabla */}
                <div className="bg-slate-800/30 border border-slate-700 rounded-2xl overflow-hidden">
                  <div className="overflow-auto max-h-[600px]">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800 sticky top-0 z-10">
                        <tr className="text-gray-400 uppercase text-xs tracking-wider">
                          <th className="text-left px-4 py-3">R. Social</th>
                          <th className="text-left px-4 py-3">Local</th>
                          <th className="text-left px-4 py-3">Fecha</th>
                          <th className="text-left px-4 py-3">Terminal</th>
                          <th className="text-right px-4 py-3">Bruto</th>
                          <th className="text-right px-4 py-3">Neto</th>
                          <th className="text-right px-4 py-3 text-red-400">Total Ret.</th>
                          <th className="text-right px-4 py-3 text-red-400">Ret IIBB CABA</th>
                          <th className="text-right px-4 py-3 text-orange-400">Total Com.</th>
                          <th className="text-right px-4 py-3 text-orange-400">Com.</th>
                          <th className="text-right px-4 py-3 text-orange-400">IVA</th>
                          <th className="text-right px-4 py-3 text-orange-400">Percep IVA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paywayFiltrados.slice(0, 1000).map((row, idx) => (
                          <tr key={idx} className="border-t border-slate-700/50 hover:bg-slate-800/40">
                            <td className="px-4 py-3 text-gray-300">{row['RAZON SOCIAL']}</td>
                            <td className="px-4 py-3 text-gray-300">{row['LOCAL']}</td>
                            <td className="px-4 py-3 text-gray-300 font-mono">{row['FECHA DE VENTA']}</td>
                            <td className="px-4 py-3 text-gray-300 font-mono">{row['TERMINAL']}</td>
                            <td className="px-4 py-3 text-right text-white font-mono">{formatMoneyPayway(row['MONTO BRUTO'])}</td>
                            <td className="px-4 py-3 text-right text-emerald-400 font-mono">{formatMoneyPayway(row['MONTO NETO'])}</td>
                            <td className="px-4 py-3 text-right text-red-400 font-mono">{formatMoneyPayway(row['TOTAL RET.'])}</td>
                            <td className="px-4 py-3 text-right text-red-400 font-mono">{formatMoneyPayway(row['RET IIBB'])}</td>
                            <td className="px-4 py-3 text-right text-orange-400 font-mono">{formatMoneyPayway(row['TOTAL COM.'])}</td>
                            <td className="px-4 py-3 text-right text-orange-400 font-mono">{formatMoneyPayway(row['COM. TOTAL'])}</td>
                            <td className="px-4 py-3 text-right text-orange-400 font-mono">{formatMoneyPayway(row['IVA COM.'])}</td>
                            <td className="px-4 py-3 text-right text-orange-400 font-mono">{formatMoneyPayway(row['PERCEP IVA'])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {paywayFiltrados.length > 1000 && (
                    <div className="px-4 py-3 text-center text-sm text-gray-400 bg-slate-800/50 border-t border-slate-700">
                      Mostrando las primeras 1000 transferencias. El Excel exportado incluye las {paywayFiltrados.length} transferencias filtradas.
                    </div>
                  )}
                  {paywayFiltrados.length === 0 && (
                    <div className="px-4 py-12 text-center text-gray-400">
                      No hay transferencias que coincidan con los filtros aplicados.
                    </div>
                  )}
                </div>
              </div>
            ) : selectedType === 'extractos' && extractosRows.length > 0 ? (
              /* Dashboard de extractos bancarios con totales, filtros y tabla */
              <div className="space-y-6">
                {/* Botones acción */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
                  <button
                    onClick={exportarExtractosExcel}
                    disabled={isExportingExtractos || extractosFiltrados.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExportingExtractos ? (
                      <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    )}
                    Exportar Reporte
                  </button>
                  <button
                    onClick={limpiarFiltrosExtractos}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                    </svg>
                    Limpiar
                  </button>
                  <button
                    onClick={() => {
                      setExtractosRows([]);
                      limpiarFiltrosExtractos();
                    }}
                    className="ml-auto inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Subir nuevos archivos →
                  </button>
                </div>

                {/* Totales */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                    <p className="text-sm uppercase tracking-wider text-gray-400 mb-2">Total Débitos (-)</p>
                    <p className="text-3xl md:text-4xl font-bold text-red-400 italic font-mono">
                      {formatMoney(totalDebitosExtractos)}
                    </p>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                    <p className="text-sm uppercase tracking-wider text-gray-400 mb-2">Total Créditos (+)</p>
                    <p className="text-3xl md:text-4xl font-bold text-emerald-400 italic font-mono">
                      {formatMoney(totalCreditosExtractos)}
                    </p>
                  </div>
                </div>

                {/* Filtros */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-gray-300 font-medium uppercase tracking-wider text-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      Filtros
                    </div>
                    <select
                      value={extractosFiltroEmpresa}
                      onChange={(e) => setExtractosFiltroEmpresa(e.target.value)}
                      className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="all">Todas las Empresas</option>
                      {empresasExtractos.map(e => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                    <select
                      value={extractosFiltroBanco}
                      onChange={(e) => setExtractosFiltroBanco(e.target.value)}
                      className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="all">Todos los Bancos</option>
                      {bancosExtractos.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={extractosFiltroFechaDesde}
                      onChange={(e) => setExtractosFiltroFechaDesde(e.target.value)}
                      className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      title="Desde"
                    />
                    <input
                      type="date"
                      value={extractosFiltroFechaHasta}
                      onChange={(e) => setExtractosFiltroFechaHasta(e.target.value)}
                      className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      title="Hasta"
                    />
                    <span className="ml-auto italic text-gray-400 text-sm">
                      Viendo <strong className="text-white">{extractosFiltrados.length}</strong> de{' '}
                      <strong className="text-white">{extractosRows.length}</strong> movimientos
                    </span>
                  </div>
                </div>

                {/* Tabla */}
                <div className="bg-slate-800/30 border border-slate-700 rounded-2xl overflow-hidden">
                  <div className="overflow-auto max-h-[600px]">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800 sticky top-0 z-10">
                        <tr className="text-gray-400 uppercase text-xs tracking-wider">
                          <th className="text-left px-4 py-3">Razón Social</th>
                          <th className="text-left px-4 py-3">Banco</th>
                          <th className="text-left px-4 py-3">Fecha</th>
                          <th className="text-left px-4 py-3">Descripción</th>
                          <th className="text-left px-4 py-3">Leyenda / Referencia</th>
                          <th className="text-right px-4 py-3">Débito</th>
                          <th className="text-right px-4 py-3">Crédito</th>
                          <th className="text-right px-4 py-3">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extractosFiltrados.slice(0, 1000).map((row, idx) => (
                          <tr key={idx} className="border-t border-slate-700/50 hover:bg-slate-800/40">
                            <td className="px-4 py-3 text-indigo-300 font-medium italic">{row['Razón Social']}</td>
                            <td className="px-4 py-3 italic text-gray-300">{row['Banco']}</td>
                            <td className="px-4 py-3 text-gray-300 font-mono">{row['Fecha']}</td>
                            <td className="px-4 py-3 text-gray-200">{row['Descripción']}</td>
                            <td className="px-4 py-3 text-gray-400">{row['Leyenda / Referencia']}</td>
                            <td className="px-4 py-3 text-right text-red-400 font-mono">
                              {row['Débito'] ? formatMoney(row['Débito']) : ''}
                            </td>
                            <td className="px-4 py-3 text-right text-emerald-400 font-mono">
                              {row['Crédito'] ? formatMoney(row['Crédito']) : ''}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-300 font-mono">
                              {formatMoney(row['Saldo'])}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {extractosFiltrados.length > 1000 && (
                    <div className="px-4 py-3 text-center text-sm text-gray-400 bg-slate-800/50 border-t border-slate-700">
                      Mostrando los primeros 1000 movimientos. El Excel exportado incluye los {extractosFiltrados.length} movimientos filtrados.
                    </div>
                  )}
                  {extractosFiltrados.length === 0 && (
                    <div className="px-4 py-12 text-center text-gray-400">
                      No hay movimientos que coincidan con los filtros aplicados.
                    </div>
                  )}
                </div>
              </div>
            ) : selectedType === 'conciliacion' ? (
              /* Interfaz especial para conciliación: 2 zonas de subida */
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Zona Oppen */}
                <div className="gradient-border">
                  <div
                    className={`gradient-border-content upload-zone p-8 text-center cursor-pointer ${
                      isDraggingOppen ? 'dragging' : ''
                    } ${oppenFile ? 'border-green-500' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingOppen(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDraggingOppen(false); }}
                    onDrop={handleDropOppen}
                    onClick={() => document.getElementById('oppenFileInput')?.click()}
                  >
                    <input
                      id="oppenFileInput"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileInputOppen}
                      className="hidden"
                    />

                    <div className="flex flex-col items-center">
                      <div className={`w-16 h-16 mb-4 rounded-full ${oppenFile ? 'bg-green-500' : 'bg-gradient-to-br from-orange-400 to-amber-600'} flex items-center justify-center`}>
                        {oppenFile ? (
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        )}
                      </div>

                      <h3 className="text-xl font-semibold mb-2 text-orange-500">
                        Archivo OPPEN
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
                        Listado de Facturas de Compra
                      </p>
                      {oppenFile ? (
                        <div className="flex items-center gap-2">
                          <span className="text-green-500 font-medium truncate max-w-[200px]">{oppenFile.name}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setOppenFile(null); }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-orange-400 to-amber-600 text-white rounded-lg font-medium text-sm">
                          Seleccionar Excel
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Zona ARCA */}
                <div className="gradient-border">
                  <div
                    className={`gradient-border-content upload-zone p-8 text-center cursor-pointer ${
                      isDraggingArcaConcil ? 'dragging' : ''
                    } ${arcaConcilFile ? 'border-green-500' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingArcaConcil(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDraggingArcaConcil(false); }}
                    onDrop={handleDropArcaConcil}
                    onClick={() => document.getElementById('arcaConcilFileInput')?.click()}
                  >
                    <input
                      id="arcaConcilFileInput"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileInputArcaConcil}
                      className="hidden"
                    />

                    <div className="flex flex-col items-center">
                      <div className={`w-16 h-16 mb-4 rounded-full ${arcaConcilFile ? 'bg-green-500' : 'bg-gradient-to-br from-cyan-400 to-teal-600'} flex items-center justify-center`}>
                        {arcaConcilFile ? (
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        )}
                      </div>

                      <h3 className="text-xl font-semibold mb-2 text-cyan-500">
                        Archivo ARCA
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
                        Comprobantes descargados de AFIP
                      </p>
                      {arcaConcilFile ? (
                        <div className="flex items-center gap-2">
                          <span className="text-green-500 font-medium truncate max-w-[200px]">{arcaConcilFile.name}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setArcaConcilFile(null); }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-cyan-400 to-teal-600 text-white rounded-lg font-medium text-sm">
                          Seleccionar Excel
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="gradient-border mb-8">
                <div
                  className={`gradient-border-content upload-zone p-12 text-center cursor-pointer ${
                    isDragging ? 'dragging' : ''
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('fileInput')?.click()}
                >
                  <input
                    id="fileInput"
                    type="file"
                    multiple
                    accept={selectedType === 'arca' ? '.csv' : selectedType === 'proveedores' ? '.pdf,image/*' : selectedType === 'liquidaciones' ? '.pdf,.zip' : selectedType === 'extractos' ? '.csv,.xls,.xlsx' : selectedType === 'payway' ? '.xls,.xlsx' : selectedType === 'bazar' ? '.pdf,image/*' : '.pdf'}
                    onChange={handleFileInput}
                    className="hidden"
                  />

                  <div className="flex flex-col items-center">
                    <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <svg
                        className="w-12 h-12 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                    </div>

                    <h3 className="text-2xl font-semibold mb-2">
                      Arrastra tus archivos {selectedType === 'arca' ? 'CSV' : selectedType === 'proveedores' ? 'PDF o imágenes' : selectedType === 'ddjj' ? 'PDF de DDJJ IVA' : selectedType === 'liquidaciones' ? 'PDF o ZIP con PDFs' : selectedType === 'extractos' ? 'CSV, XLS o XLSX de extractos' : selectedType === 'payway' ? 'XLS o XLSX de Payway' : selectedType === 'bazar' ? 'PDF o imágenes de facturas' : 'PDF'} aquí
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      o haz clic para seleccionarlos
                    </p>
                    <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-shadow">
                      Seleccionar archivos
                    </div>
                  </div>
                </div>
              </div>
            )}

            {files.length > 0 && (
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">
                    Archivos seleccionados ({files.length})
                  </h3>
                  <button
                    onClick={() => setFiles([])}
                    className="text-red-500 hover:text-red-700 font-medium"
                  >
                    Limpiar todo
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <svg
                          className="w-8 h-8 text-red-500 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{file.name}</p>
                          <p className="text-sm text-gray-500">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="ml-4 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(files.length > 0 || (selectedType === 'conciliacion' && oppenFile && arcaConcilFile)) && (
              <div className="text-center">
                <button
                  onClick={handleProcess}
                  disabled={isProcessing || (selectedType === 'conciliacion' && (!oppenFile || !arcaConcilFile))}
                  className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-primary via-secondary to-accent rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isProcessing ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-6 w-6 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-6 h-6 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Generar Excel
                    </>
                  )}
                </button>
              </div>
            )}

            {processedCount > 0 && (
              <div className="mt-8 p-6 bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-xl text-center">
                <svg
                  className="w-16 h-16 text-green-500 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
                  ¡Procesamiento completado!
                </h3>
                <p className="text-green-600 dark:text-green-300">
                  Se procesaron {processedCount} archivo{processedCount > 1 ? 's' : ''} exitosamente
                </p>
              </div>
            )}
          </>
        )}

        {!selectedType && (
          <div className="mt-16 pt-8 border-t border-gray-200 dark:border-slate-700">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <h4 className="font-semibold mb-2">Rápido y Eficiente</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Procesa múltiples documentos en segundos
                </p>
              </div>

              <div className="text-center p-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <h4 className="font-semibold mb-2">100% Seguro</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Tus datos se procesan localmente
                </p>
              </div>

              <div className="text-center p-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <h4 className="font-semibold mb-2">Datos Estructurados</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Excel organizado y listo para usar
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
