import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Pencil, 
  TrendingUp, 
  Minus, 
  MoveRight,
  GitBranch,
  Trash2,
  XCircle
} from "lucide-react";
import type { Drawing } from "./chart-utils";

export type DrawingTool = 'none' | 'trendline' | 'hline' | 'ray' | 'fib';

interface DrawingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTool: DrawingTool;
  onToolSelect: (tool: DrawingTool) => void;
  drawings: Drawing[];
  selectedDrawingId: string | null;
  onDrawingSelect: (id: string | null) => void;
  onDeleteSelected: () => void;
  onClearAll: () => void;
}

const drawingTools: { id: DrawingTool; label: string; icon: any; description: string }[] = [
  { id: 'trendline', label: 'Trend Line', icon: TrendingUp, description: 'Connect two price points' },
  { id: 'hline', label: 'Horizontal Line', icon: Minus, description: 'Mark support/resistance level' },
  { id: 'ray', label: 'Ray Line', icon: MoveRight, description: 'Extends from start point' },
  { id: 'fib', label: 'Fibonacci', icon: GitBranch, description: 'Retracement levels' },
];

export function DrawingsDrawer({
  open,
  onOpenChange,
  activeTool,
  onToolSelect,
  drawings,
  selectedDrawingId,
  onDrawingSelect,
  onDeleteSelected,
  onClearAll,
}: DrawingsDrawerProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleToolClick = (tool: DrawingTool) => {
    if (activeTool === tool) {
      onToolSelect('none');
    } else {
      onToolSelect(tool);
      onOpenChange(false);
    }
  };

  const handleClearAll = () => {
    setShowClearConfirm(true);
  };

  const confirmClearAll = () => {
    onClearAll();
    setShowClearConfirm(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[300px] sm:w-[350px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Drawing Tools
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Select Tool</h3>
              
              <div className="grid grid-cols-2 gap-2">
                {drawingTools.map((tool) => {
                  const Icon = tool.icon;
                  const isActive = activeTool === tool.id;
                  return (
                    <Button
                      key={tool.id}
                      variant={isActive ? 'default' : 'outline'}
                      className="h-auto flex-col py-3 gap-1"
                      onClick={() => handleToolClick(tool.id)}
                      data-testid={`button-tool-${tool.id}`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs">{tool.label}</span>
                    </Button>
                  );
                })}
              </div>

              {activeTool !== 'none' && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Click on chart to start drawing. Press ESC to cancel.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Drawings ({drawings.length})
              </h3>

              {drawings.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No drawings yet. Select a tool and click on the chart.
                </p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {drawings.map((drawing) => (
                    <button
                      key={drawing.id}
                      type="button"
                      onClick={() => onDrawingSelect(selectedDrawingId === drawing.id ? null : drawing.id)}
                      className={`w-full flex items-center justify-between p-2 rounded text-sm cursor-pointer transition-colors ${
                        selectedDrawingId === drawing.id ? 'bg-[#22D3EE]/20 border border-[#22D3EE]/30' : 'bg-muted/50 hover:bg-muted'
                      }`}
                      data-testid={`drawing-item-${drawing.id}`}
                    >
                      <span className="capitalize">{drawing.type}</span>
                      <span className="text-xs text-muted-foreground">
                        {drawing.points.length} pts
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Actions</h3>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={onDeleteSelected}
                  disabled={!selectedDrawingId}
                  data-testid="button-delete-drawing"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={handleClearAll}
                  disabled={drawings.length === 0}
                  data-testid="button-clear-drawings"
                >
                  <XCircle className="h-4 w-4" />
                  Clear All
                </Button>
              </div>
            </div>

            {selectedDrawingId && (
              <div className="p-3 rounded-lg bg-[#22D3EE]/10 border border-[#22D3EE]/20">
                <p className="text-xs text-[#22D3EE]">
                  <strong>Tip:</strong> Drag endpoints to resize, drag body to move. Press Delete/Backspace to remove.
                </p>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-drawings"
            >
              Close
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Drawings?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove all {drawings.length} drawing{drawings.length !== 1 ? 's' : ''} from the chart. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-clear">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-clear"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
