'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type ProcessType = 'facturas' | 'liquidaciones' | 'arca' | 'proveedores' | 'ddjj';

export default function Home() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<ProcessType | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

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

  const handleProcess = async () => {
    if (files.length === 0 || !selectedType) return;

    setIsProcessing(true);
    setProcessedCount(0);

    // Todos los tipos usan descarga directa
    const apiEndpoint = selectedType === 'facturas' ? '/api/process-pdfs' :
                        selectedType === 'liquidaciones' ? '/api/process-liquidations' :
                        selectedType === 'ddjj' ? '/api/process-ddjj' :
                        selectedType === 'proveedores' ? '/api/process-proveedores' :
                        '/api/process-arca';
    const downloadFilename = selectedType === 'facturas' ? 'facturas_procesadas.xlsx' :
                             selectedType === 'liquidaciones' ? 'liquidaciones_tarjetas.xlsx' :
                             selectedType === 'ddjj' ? 'ddjj_iva.xlsx' :
                             selectedType === 'proveedores' ? 'facturas_proveedores.xlsx' :
                             'comprobantes_arca_consolidados.xlsx';

    try {
      // Para proveedores, procesar en lotes de 3 archivos para evitar error 413
      if (selectedType === 'proveedores' && files.length > 3) {
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
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
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
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${selectedType === 'facturas' ? 'bg-gradient-to-br from-blue-400 to-blue-600' : selectedType === 'liquidaciones' ? 'bg-gradient-to-br from-purple-400 to-purple-600' : selectedType === 'proveedores' ? 'bg-gradient-to-br from-orange-400 to-amber-600' : selectedType === 'ddjj' ? 'bg-gradient-to-br from-pink-400 to-rose-600' : 'bg-gradient-to-br from-green-400 to-emerald-600'} flex items-center justify-center`}>
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
                  {selectedType === 'facturas' ? 'Desglose Facturas Arca' : selectedType === 'liquidaciones' ? 'Liquidaciones de Tarjetas' : selectedType === 'proveedores' ? 'Desglose Facturas Proveedores' : selectedType === 'ddjj' ? 'Extractor Declaración Jurada' : 'Bot ARCA'}
                </h2>
              </div>
              <button
                onClick={resetSelection}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 font-medium transition-colors"
              >
                ← Volver a opciones
              </button>
            </div>

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
                  accept={selectedType === 'arca' ? '.csv' : selectedType === 'proveedores' ? '.pdf,image/*' : '.pdf'}
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
                    Arrastra tus archivos {selectedType === 'arca' ? 'CSV' : selectedType === 'proveedores' ? 'PDF o imágenes' : selectedType === 'ddjj' ? 'PDF de DDJJ IVA' : 'PDF'} aquí
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

            {files.length > 0 && (
              <div className="text-center">
                <button
                  onClick={handleProcess}
                  disabled={isProcessing}
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
