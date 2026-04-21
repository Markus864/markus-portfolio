import { TradingSignal } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface SignalTableProps {
  signals: TradingSignal[];
}

export function SignalTable({ signals }: SignalTableProps) {
  const getActionIcon = (action: TradingSignal["action"]) => {
    switch (action) {
      case "BUY_CALL":
      case "SELL_PUT":
        return <TrendingUp className="h-4 w-4" />;
      case "BUY_PUT":
      case "SELL_CALL":
        return <TrendingDown className="h-4 w-4" />;
      case "HOLD":
        return <Minus className="h-4 w-4" />;
    }
  };

  const getActionVariant = (action: TradingSignal["action"]) => {
    switch (action) {
      case "BUY_CALL":
        return "default" as const;
      case "BUY_PUT":
        return "destructive" as const;
      case "SELL_CALL":
      case "SELL_PUT":
        return "secondary" as const;
      case "HOLD":
        return "outline" as const;
    }
  };

  const formatExpiry = (dateStr: string) => {
    // Parse date string manually to avoid UTC timezone shift
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-bold uppercase text-xs tracking-wide">
              Symbol
            </TableHead>
            <TableHead className="font-bold uppercase text-xs tracking-wide">
              Action
            </TableHead>
            <TableHead className="font-bold uppercase text-xs tracking-wide text-right">
              Strike
            </TableHead>
            <TableHead className="font-bold uppercase text-xs tracking-wide text-right">
              Expiry
            </TableHead>
            <TableHead className="font-bold uppercase text-xs tracking-wide text-right">
              Premium
            </TableHead>
            <TableHead className="font-bold uppercase text-xs tracking-wide text-right">
              Contracts
            </TableHead>
            <TableHead className="font-bold uppercase text-xs tracking-wide text-right">
              Max Loss
            </TableHead>
            <TableHead className="font-bold uppercase text-xs tracking-wide text-right">
              Max Gain
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {signals.map((signal) => (
            <TableRow
              key={signal.symbol}
              className="hover-elevate"
              data-testid={`row-signal-${signal.symbol}`}
            >
              <TableCell className="font-bold" data-testid={`cell-symbol-${signal.symbol}`}>
                {signal.symbol}
              </TableCell>
              <TableCell>
                <Badge
                  variant={getActionVariant(signal.action)}
                  className="gap-1.5 px-2 py-0.5 text-xs font-bold uppercase"
                  data-testid={`cell-action-${signal.symbol}`}
                >
                  {getActionIcon(signal.action)}
                  {signal.action}
                </Badge>
              </TableCell>
              <TableCell
                className="text-right font-mono font-semibold"
                data-testid={`cell-strike-${signal.symbol}`}
              >
                ${signal.strikePrice} {signal.optionType}
              </TableCell>
              <TableCell
                className="text-right font-mono font-semibold"
                data-testid={`cell-expiry-${signal.symbol}`}
              >
                {signal.expirationDate ? formatExpiry(signal.expirationDate) : '-'}
              </TableCell>
              <TableCell
                className="text-right font-mono font-semibold"
                data-testid={`cell-premium-${signal.symbol}`}
              >
                {signal.premium != null ? `$${signal.premium.toFixed(2)}` : '-'}
              </TableCell>
              <TableCell
                className="text-right font-mono font-semibold"
                data-testid={`cell-contracts-${signal.symbol}`}
              >
                {signal.contracts}
              </TableCell>
              <TableCell
                className="text-right font-mono font-semibold text-destructive"
                data-testid={`cell-maxloss-${signal.symbol}`}
              >
                {signal.maxLoss != null ? `$${typeof signal.maxLoss === 'number' ? signal.maxLoss.toLocaleString() : signal.maxLoss}` : '-'}
              </TableCell>
              <TableCell
                className="text-right font-mono font-semibold text-chart-2"
                data-testid={`cell-maxgain-${signal.symbol}`}
              >
                {signal.maxGain == null 
                  ? '-'
                  : typeof signal.maxGain === 'string' 
                    ? (signal.maxGain === "Unlimited" ? "Unlimited" : `$${parseFloat(signal.maxGain).toLocaleString()}`)
                    : (signal.maxGain >= 999999 ? "Unlimited" : `$${signal.maxGain.toLocaleString()}`)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
