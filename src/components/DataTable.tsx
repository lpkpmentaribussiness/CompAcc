import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState
} from '@tanstack/react-table'
import { ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useState } from 'react'
import { Button, Input } from './ui'

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = 'Cari data...',
  emptyMessage = 'Belum ada data.'
}: {
  data: T[]
  columns: ColumnDef<T>[]
  searchPlaceholder?: string
  emptyMessage?: string
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } }
  })

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 sm:px-5">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
          <Input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder={searchPlaceholder} className="pl-9" />
        </div>
        <div className="hidden text-xs font-semibold text-slate-400 sm:block">{table.getFilteredRowModel().rows.length} data</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} className="px-5 py-3 font-bold">
                    {header.isPlaceholder ? null : (
                      <button
                        className="inline-flex items-center gap-1"
                        onClick={header.column.getToggleSortingHandler()}
                        disabled={!header.column.getCanSort()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && <ChevronDown size={13} className={header.column.getIsSorted() ? 'text-brand-600' : 'text-slate-300'} />}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="transition hover:bg-slate-50/70">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-5 py-4">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            )) : (
              <tr><td colSpan={columns.length} className="p-12 text-center text-sm text-slate-400">{emptyMessage}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
        <p className="text-xs text-slate-400">Halaman {table.getState().pagination.pageIndex + 1} dari {Math.max(1, table.getPageCount())}</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Halaman sebelumnya"><ChevronLeft size={16} /></Button>
          <Button variant="secondary" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Halaman berikutnya"><ChevronRight size={16} /></Button>
        </div>
      </div>
    </>
  )
}
