import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ArrowLeft, MessageSquare, Clock, Send, Bot, Loader2, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Footer } from "@/components/Footer";
import { SUPPORT_PORTAL_URL } from "@/lib/support-constants";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Contact() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coachMessage, setCoachMessage] = useState("");
  const [coachResponse, setCoachResponse] = useState<string | null>(null);

  const coachMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/chat", { message });
      return res.json();
    },
    onSuccess: (data) => {
      setCoachResponse(data.response || data.structured?.answer || "Ready to assist.");
    },
    onError: () => {
      setCoachResponse("Unable to process request. Try again.");
    }
  });

  const handleCoachSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (coachMessage.trim()) {
      coachMutation.mutate(coachMessage);
      setCoachMessage("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
          channel: "web",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Message Sent",
          description: `Your support ticket #${data.ticketNumber} has been created. We'll respond within 24-48 hours.`,
        });
        setFormData({ name: "", email: "", subject: "", message: "" });
      } else {
        throw new Error(data.error || "Failed to submit ticket");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit your message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="contact-page">
      <div className="container mx-auto px-4 py-12 flex-1">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="pl-0" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
            </Button>
          </Link>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-foreground mb-3">Get in Touch</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Have a question or need assistance? Our team is here to help you succeed with your trading journey.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" /> 
                    Send Us a Message
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input 
                          id="name"
                          placeholder="John Smith" 
                          value={formData.name} 
                          onChange={e => setFormData({...formData, name: e.target.value})} 
                          data-testid="input-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input 
                          id="email"
                          type="email" 
                          placeholder="john@example.com" 
                          value={formData.email} 
                          onChange={e => setFormData({...formData, email: e.target.value})} 
                          data-testid="input-email"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input 
                        id="subject"
                        placeholder="How can we help you?" 
                        value={formData.subject} 
                        onChange={e => setFormData({...formData, subject: e.target.value})} 
                        data-testid="input-subject"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea 
                        id="message"
                        placeholder="Please describe your question or issue in detail..." 
                        rows={5}
                        value={formData.message} 
                        onChange={e => setFormData({...formData, message: e.target.value})} 
                        data-testid="input-message"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-submit">
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" /> Send Message
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="w-full lg:w-80 space-y-5">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> Response Time
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">
                    We typically respond within <span className="text-foreground font-medium">24-48 hours</span> during business days.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" /> Email Us
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">General Inquiries</p>
                    <a href="mailto:info@ironstriketrading.com" className="text-primary hover:underline text-sm">
                      info@ironstriketrading.com
                    </a>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Support Center</p>
                    <a href={SUPPORT_PORTAL_URL} className="text-primary hover:underline text-sm" target="_blank" rel="noopener noreferrer">
                      Visit Help Center
                    </a>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-coach">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-primary" />
                    Quick Help
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Need a quick answer? Ask our AI assistant.
                  </p>
                  {coachResponse && (
                    <div className="p-3 bg-muted rounded-md text-sm text-foreground" data-testid="text-coach-response">
                      {coachResponse}
                    </div>
                  )}
                  <form onSubmit={handleCoachSubmit} className="flex gap-2">
                    <Input
                      placeholder="Ask a question..."
                      value={coachMessage}
                      onChange={(e) => setCoachMessage(e.target.value)}
                      className="flex-1 text-sm"
                      data-testid="input-coach-message"
                    />
                    <Button 
                      type="submit" 
                      size="icon" 
                      disabled={coachMutation.isPending || !coachMessage.trim()}
                      data-testid="button-coach-send"
                    >
                      {coachMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
