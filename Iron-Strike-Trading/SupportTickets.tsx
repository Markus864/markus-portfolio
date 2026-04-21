import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ticket, RefreshCw, CheckCircle, Clock, AlertCircle, XCircle, Mail, MessageSquare, Bot, ExternalLink } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { format } from "date-fns";
import type { SelectSupportTicket } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const statusColors: Record<string, string> = {
  open: "bg-blue-500",
  in_progress: "bg-yellow-500",
  resolved: "bg-green-500",
  closed: "bg-slate-500",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-400",
  normal: "bg-blue-400",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

const channelIcons: Record<string, JSX.Element> = {
  web: <Mail className="h-4 w-4" />,
  telegram: <MessageSquare className="h-4 w-4" />,
  discord: <MessageSquare className="h-4 w-4" />,
  chatbot: <Bot className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
};

const statusIcons: Record<string, JSX.Element> = {
  open: <AlertCircle className="h-4 w-4" />,
  in_progress: <Clock className="h-4 w-4" />,
  resolved: <CheckCircle className="h-4 w-4" />,
  closed: <XCircle className="h-4 w-4" />,
};

export default function SupportTickets() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<SelectSupportTicket | null>(null);

  const { data: tickets = [], isLoading, refetch } = useQuery<SelectSupportTicket[]>({
    queryKey: ["/api/tickets", statusFilter !== "all" ? { status: statusFilter } : {}],
    queryFn: async () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/tickets${params}`);
      if (!res.ok) throw new Error("Failed to fetch tickets");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("PATCH", `/api/tickets/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({ title: "Ticket Updated", description: "Status has been changed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update ticket.", variant: "destructive" });
    },
  });

  const openCount = tickets.filter(t => t.status === "open").length;
  const inProgressCount = tickets.filter(t => t.status === "in_progress").length;
  const resolvedCount = tickets.filter(t => t.status === "resolved").length;

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 rounded-lg bg-muted">
          <Ticket className="h-6 w-6 text-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-support-tickets">Support Tickets</h1>
          <p className="text-muted-foreground">Manage customer support requests</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-2xl font-bold text-blue-500" data-testid="text-open-count">{openCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-yellow-500" data-testid="text-progress-count">{inProgressCount}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold text-green-500" data-testid="text-resolved-count">{resolvedCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold" data-testid="text-total-count">{tickets.length}</p>
              </div>
              <Ticket className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>All Tickets</CardTitle>
              <CardDescription>View and manage support requests</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => {
                  const freshdeskDomain = import.meta.env.VITE_FRESHDESK_DOMAIN || "ironstrike";
                  window.open(`https://${freshdeskDomain}.freshdesk.com/support/tickets/new`, "_blank");
                }}
                className="gap-2"
                data-testid="button-submit-ticket"
              >
                <ExternalLink className="h-4 w-4" />
                Submit Ticket
              </Button>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No tickets found</div>
          ) : (
            <Table data-testid="table-tickets">
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket #</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id} data-testid={`row-ticket-${ticket.id}`}>
                    <TableCell className="font-mono text-foreground">{ticket.ticketNumber}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{ticket.subject}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ticket.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {channelIcons[ticket.channel] || <Mail className="h-4 w-4" />}
                        <span className="text-xs capitalize">{ticket.channel}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={priorityColors[ticket.priority]}>
                        {ticket.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`${statusColors[ticket.status]} flex items-center gap-1 w-fit`}>
                        {statusIcons[ticket.status]}
                        {ticket.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(ticket.createdAt), "MMM d, h:mm a")}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setSelectedTicket(ticket)}
                            data-testid={`button-view-ticket-${ticket.id}`}
                          >
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <span className="font-mono text-foreground">{ticket.ticketNumber}</span>
                              <Badge variant="secondary" className={statusColors[ticket.status]}>
                                {ticket.status.replace("_", " ")}
                              </Badge>
                            </DialogTitle>
                            <DialogDescription>{ticket.subject}</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">From</p>
                                <p className="font-medium">{ticket.name || "Anonymous"}</p>
                                <p className="text-foreground">{ticket.email}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Channel</p>
                                <p className="capitalize">{ticket.channel}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Priority</p>
                                <Badge variant="secondary" className={priorityColors[ticket.priority]}>
                                  {ticket.priority}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Created</p>
                                <p>{format(new Date(ticket.createdAt), "PPpp")}</p>
                              </div>
                            </div>
                            <div className="border-t pt-4">
                              <p className="text-muted-foreground text-sm mb-2">Message</p>
                              <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap">
                                {ticket.message}
                              </div>
                            </div>
                            <div className="border-t pt-4">
                              <p className="text-muted-foreground text-sm mb-2">Update Status</p>
                              <div className="flex gap-2 flex-wrap">
                                {["open", "in_progress", "resolved", "closed"].map((status) => (
                                  <Button
                                    key={status}
                                    variant={ticket.status === status ? "default" : "outline"}
                                    size="sm"
                                    disabled={updateMutation.isPending}
                                    onClick={() => updateMutation.mutate({ id: ticket.id, status })}
                                    data-testid={`button-status-${status}`}
                                  >
                                    {status.replace("_", " ")}
                                  </Button>
                                ))}
                              </div>
                            </div>
                            <div className="border-t pt-4">
                              <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => window.open(`mailto:${ticket.email}?subject=Re: ${ticket.subject} [${ticket.ticketNumber}]`)}
                                data-testid="button-reply-email"
                              >
                                <Mail className="h-4 w-4 mr-2" />
                                Reply via Email
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
