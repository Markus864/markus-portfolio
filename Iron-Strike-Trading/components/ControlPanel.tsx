import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, TrendingUp, Sparkles, DollarSign, Shield } from "lucide-react";

const riskProfiles = [
  "UltraConservative",
  "Conservative", 
  "Balanced",
  "Growth",
  "Aggressive",
] as const;

type RiskProfile = typeof riskProfiles[number];

export interface SignalParams {
  symbols: string[];
  accountSize: number;
  riskProfile: RiskProfile;
}

interface ControlPanelProps {
  onGenerate: (params: SignalParams) => void;
  isLoading: boolean;
  currentParams?: Partial<SignalParams>;
}

export function ControlPanel({ onGenerate, isLoading, currentParams }: ControlPanelProps) {
  const [symbolInput, setSymbolInput] = useState("");
  const [symbols, setSymbols] = useState<string[]>(["AAPL", "MSFT", "TSLA"]);
  const [accountSizeInput, setAccountSizeInput] = useState(String(currentParams?.accountSize ?? 5000));
  const accountSize = Number(accountSizeInput) || 5000;
  const [riskProfile, setRiskProfile] = useState<RiskProfile>(currentParams?.riskProfile ?? "Balanced");

  const handleAddSymbol = () => {
    const trimmed = symbolInput.trim().toUpperCase();
    if (trimmed && !symbols.includes(trimmed) && symbols.length < 10) {
      setSymbols([...symbols, trimmed]);
      setSymbolInput("");
    }
  };

  const handleRemoveSymbol = (symbol: string) => {
    setSymbols(symbols.filter((s) => s !== symbol));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSymbol();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (symbols.length > 0 && !isLoading) {
      onGenerate({ symbols, accountSize, riskProfile });
    }
  };

  const getAccountSize = () => accountSize;

  return (
    <Card className="overflow-visible">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Options Signal Generator
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure your options trading parameters
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="symbols" className="text-sm font-semibold">
              Underlying Symbols
            </Label>
            <div className="flex gap-2">
              <Input
                id="symbols"
                placeholder="Enter symbol (e.g., AAPL)"
                value={symbolInput}
                onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                className="h-12"
                disabled={isLoading}
                maxLength={10}
                data-testid="input-symbol"
              />
              <Button
                type="button"
                onClick={handleAddSymbol}
                disabled={
                  !symbolInput.trim() ||
                  symbols.length >= 10 ||
                  isLoading
                }
                size="icon"
                className="h-12 w-12 shrink-0"
                data-testid="button-add-symbol"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            {symbols.length > 0 && (
              <div
                className="flex flex-wrap gap-2 pt-2"
                data-testid="container-symbols"
              >
                {symbols.map((symbol) => (
                  <Badge
                    key={symbol}
                    variant="secondary"
                    className="gap-1.5 px-3 py-1.5 text-sm font-semibold"
                    data-testid={`badge-chip-${symbol}`}
                  >
                    {symbol}
                    <button
                      type="button"
                      onClick={() => handleRemoveSymbol(symbol)}
                      className="hover-elevate active-elevate-2 rounded-full p-0.5"
                      disabled={isLoading}
                      data-testid={`button-remove-${symbol}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Add up to 10 symbols • Press Enter to add
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="accountSize" className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Account Size
            </Label>
            <Input
              id="accountSize"
              type="number"
              min={100}
              step={100}
              value={accountSizeInput}
              onChange={(e) => setAccountSizeInput(e.target.value)}
              className="h-12 font-mono"
              disabled={isLoading}
              data-testid="input-account-size"
            />
            <p className="text-xs text-muted-foreground">
              Used to size positions based on your risk profile
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="riskProfile" className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Risk Profile
            </Label>
            <Select
              value={riskProfile}
              onValueChange={(value) => setRiskProfile(value as RiskProfile)}
              disabled={isLoading}
            >
              <SelectTrigger className="h-12" data-testid="select-risk-profile">
                <SelectValue placeholder="Select risk profile" />
              </SelectTrigger>
              <SelectContent>
                {riskProfiles.map((profile) => (
                  <SelectItem key={profile} value={profile} data-testid={`option-risk-${profile}`}>
                    {profile}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Controls max risk per trade (1-5% of account)
            </p>
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold gap-2"
            disabled={symbols.length === 0 || isLoading}
            data-testid="button-generate"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Analyzing Options...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate Options Signals
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
