import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import RiskBadge from "@/components/RiskBadge";
import DriverChips from "@/components/DriverChips";

type SortDir = "asc" | "desc";

interface RiskTableProps {
  results: Record<string, any>[];
  probField: string;
  riskField: string;
  onSelectRow: (row: Record<string, any>) => void;
  extraColumns?: { key: string; label: string }[];
  searchQuery?: string;
}

const BASE_COLS = [
  { key: "circuit_id", label: "Circuit" },
  { key: "psa_id", label: "PSA" },
  { key: "__prob__", label: "Probability" },
  { key: "__risk__", label: "Risk" },
  { key: "customer_count", label: "Customers" },
  { key: "county", label: "County" },
  { key: "hftd_tier", label: "HFTD" },
  { key: "drivers", label: "Drivers" },
];

export default function RiskTable({
  results,
  probField,
  riskField,
  onSelectRow,
  extraColumns = [],
  searchQuery = "",
}: RiskTableProps) {
  const [sortKey, setSortKey] = useState<string>(probField);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const columns = useMemo(() => {
    const cols = [...BASE_COLS];
    // Insert extra columns before drivers
    const driverIdx = cols.findIndex((c) => c.key === "drivers");
    extraColumns.forEach((ec, i) => cols.splice(driverIdx + i, 0, ec));
    return cols;
  }, [extraColumns]);

  const filtered = useMemo(() => {
    if (!searchQuery) return results;
    const q = searchQuery.toLowerCase();
    return results.filter((r) =>
      Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q)),
    );
  }, [results, searchQuery]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const realKey =
        sortKey === "__prob__" ? probField : sortKey === "__risk__" ? riskField : sortKey;
      const av = a[realKey] ?? 0;
      const bv = b[realKey] ?? 0;
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      const primary = sortDir === "asc" ? cmp : -cmp;
      if (primary !== 0) return primary;
      // secondary: customer_count desc
      return (b.customer_count ?? 0) - (a.customer_count ?? 0);
    });
    return arr;
  }, [filtered, sortKey, sortDir, probField, riskField]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "__prob__" || key === "customer_count" ? "desc" : "asc");
    }
  }

  function renderCell(row: Record<string, any>, col: { key: string }) {
    if (col.key === "__prob__") {
      const v = row[probField];
      return v != null ? (v * 100).toFixed(1) + "%" : "—";
    }
    if (col.key === "__risk__") {
      return <RiskBadge level={row[riskField]} />;
    }
    if (col.key === "drivers") {
      return <DriverChips drivers={row.drivers} />;
    }
    if (col.key === "customer_count" || col.key === "critical_customers") {
      const v = row[col.key];
      return v != null ? v.toLocaleString() : "—";
    }
    return row[col.key] ?? "—";
  }

  function SortIcon({ colKey }: { colKey: string }) {
    if (sortKey !== colKey) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  }

  return (
    <div className="relative w-full overflow-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className="cursor-pointer select-none whitespace-nowrap text-xs"
                onClick={() => toggleSort(col.key)}
              >
                {col.label}
                <SortIcon colKey={col.key} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                No results match your filters.
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((row, i) => (
              <TableRow
                key={row.circuit_id ?? i}
                className="cursor-pointer hover:bg-accent/40 transition-colors"
                onClick={() => onSelectRow(row)}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className="text-xs py-2">
                    {renderCell(row, col)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
