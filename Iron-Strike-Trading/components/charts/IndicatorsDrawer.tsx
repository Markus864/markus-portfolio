import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BarChart3 } from "lucide-react";

interface IndicatorsConfig {
  volume: boolean;
  sma: boolean;
  smaPeriod: number;
  ema: boolean;
  emaPeriod: number;
  rsi: boolean;
  macd: boolean;
}

interface IndicatorsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: IndicatorsConfig;
  onConfigChange: (config: IndicatorsConfig) => void;
}

export function IndicatorsDrawer({
  open,
  onOpenChange,
  config,
  onConfigChange,
}: IndicatorsDrawerProps) {
  const updateConfig = (updates: Partial<IndicatorsConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[300px] sm:w-[350px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Technical Indicators
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Overlays</h3>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="volume">Volume</Label>
                <p className="text-xs text-muted-foreground">Show volume histogram</p>
              </div>
              <Switch
                id="volume"
                checked={config.volume}
                onCheckedChange={(checked) => updateConfig({ volume: checked })}
                data-testid="switch-volume"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sma">SMA (Simple Moving Average)</Label>
                  <p className="text-xs text-muted-foreground">Trend-following overlay</p>
                </div>
                <Switch
                  id="sma"
                  checked={config.sma}
                  onCheckedChange={(checked) => updateConfig({ sma: checked })}
                  data-testid="switch-sma"
                />
              </div>
              {config.sma && (
                <div className="flex items-center gap-2 pl-4">
                  <Label htmlFor="sma-period" className="text-xs whitespace-nowrap">Period:</Label>
                  <Input
                    id="sma-period"
                    type="number"
                    min={2}
                    max={200}
                    value={config.smaPeriod}
                    onChange={(e) => updateConfig({ smaPeriod: parseInt(e.target.value) || 20 })}
                    className="h-8 w-20"
                    data-testid="input-sma-period"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="ema">EMA (Exponential Moving Average)</Label>
                  <p className="text-xs text-muted-foreground">Fast-responding overlay</p>
                </div>
                <Switch
                  id="ema"
                  checked={config.ema}
                  onCheckedChange={(checked) => updateConfig({ ema: checked })}
                  data-testid="switch-ema"
                />
              </div>
              {config.ema && (
                <div className="flex items-center gap-2 pl-4">
                  <Label htmlFor="ema-period" className="text-xs whitespace-nowrap">Period:</Label>
                  <Input
                    id="ema-period"
                    type="number"
                    min={2}
                    max={200}
                    value={config.emaPeriod}
                    onChange={(e) => updateConfig({ emaPeriod: parseInt(e.target.value) || 9 })}
                    className="h-8 w-20"
                    data-testid="input-ema-period"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Oscillators</h3>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="rsi">RSI (Relative Strength Index)</Label>
                <p className="text-xs text-muted-foreground">Momentum oscillator (0-100)</p>
              </div>
              <Switch
                id="rsi"
                checked={config.rsi}
                onCheckedChange={(checked) => updateConfig({ rsi: checked })}
                data-testid="switch-rsi"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="macd">MACD</Label>
                <p className="text-xs text-muted-foreground">Trend & momentum indicator</p>
              </div>
              <Switch
                id="macd"
                checked={config.macd}
                onCheckedChange={(checked) => updateConfig({ macd: checked })}
                data-testid="switch-macd"
              />
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
            data-testid="button-close-indicators"
          >
            Apply & Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
