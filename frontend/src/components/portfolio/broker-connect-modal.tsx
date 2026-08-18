"use client";

import { useState } from "react";
import { connectBroker, BrokerCredentialsInput } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";

interface BrokerConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BrokerConnectModal({ isOpen, onClose, onSuccess }: BrokerConnectModalProps) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState<BrokerCredentialsInput>({
    broker_name: "",
    account_label: "",
    account_purpose: "long_term_wealth",
    credentials: {}
  });

  const handleBrokerSelect = (broker: string) => {
    setFormData(prev => ({ 
      ...prev, 
      broker_name: broker,
      credentials: (broker === 'zerodha' ? { api_key: "", api_secret: "", request_token: "" } 
                  : broker === 'dhan' ? { client_id: "", access_token: "" }
                  : { auth_token: "" }) as Record<string, string>
    }));
    setStep(2);
  };

  const handleCredentialChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      credentials: { ...prev.credentials, [key]: value }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await connectBroker(formData);
      toast.success("Account Connected", {
        description: `Successfully connected ${formData.broker_name} account.`,
      });
      onSuccess();
      setTimeout(() => setStep(1), 500); // Reset after close
    } catch (error: any) {
      toast.error("Connection Failed", {
        description: error.response?.data?.detail || "Invalid credentials. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Broker Account</DialogTitle>
          <DialogDescription>
            {step === 1 ? "Select your broker to connect and sync your portfolio." : "Enter your API credentials to connect."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="grid gap-4 py-4">
            <Button variant="outline" className="h-16 justify-between px-6" onClick={() => handleBrokerSelect('zerodha')}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold">Z</div>
                <span className="text-lg">Zerodha (Kite)</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Button>
            
            <Button variant="outline" className="h-16 justify-between px-6" onClick={() => handleBrokerSelect('dhan')}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">D</div>
                <span className="text-lg">Dhan</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Button>
            
            <Button variant="outline" className="h-16 justify-between px-6" onClick={() => handleBrokerSelect('groww')}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold">G</div>
                <span className="text-lg">Groww</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="account_label">Account Label</Label>
              <Input 
                id="account_label" 
                placeholder="e.g. Retirement Fund, Trading Acc"
                value={formData.account_label}
                onChange={(e) => setFormData(prev => ({ ...prev, account_label: e.target.value }))}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="purpose">Account Purpose</Label>
              <Select 
                value={formData.account_purpose} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, account_purpose: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select purpose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long_term_wealth">Long Term Wealth</SelectItem>
                  <SelectItem value="active_trading">Active Trading</SelectItem>
                  <SelectItem value="retirement">Retirement</SelectItem>
                  <SelectItem value="tax_saving">Tax Saving</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="my-4 border-t pt-4">
              <h4 className="mb-4 text-sm font-medium">API Credentials</h4>
              
              {formData.broker_name === 'zerodha' && (
                <div className="space-y-3">
                  <div className="grid gap-2">
                    <Label>API Key</Label>
                    <Input 
                      value={formData.credentials.api_key || ""} 
                      onChange={(e) => handleCredentialChange('api_key', e.target.value)}
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>API Secret</Label>
                    <Input 
                      type="password"
                      value={formData.credentials.api_secret || ""} 
                      onChange={(e) => handleCredentialChange('api_secret', e.target.value)}
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Request Token</Label>
                    <Input 
                      value={formData.credentials.request_token || ""} 
                      onChange={(e) => handleCredentialChange('request_token', e.target.value)}
                      required 
                      placeholder="Generated daily via login"
                    />
                  </div>
                </div>
              )}

              {formData.broker_name === 'dhan' && (
                <div className="space-y-3">
                  <div className="grid gap-2">
                    <Label>Client ID</Label>
                    <Input 
                      value={formData.credentials.client_id || ""} 
                      onChange={(e) => handleCredentialChange('client_id', e.target.value)}
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Access Token</Label>
                    <Input 
                      type="password"
                      value={formData.credentials.access_token || ""} 
                      onChange={(e) => handleCredentialChange('access_token', e.target.value)}
                      required 
                    />
                  </div>
                </div>
              )}

              {formData.broker_name === 'groww' && (
                <div className="space-y-3">
                  <div className="grid gap-2">
                    <Label>Auth Token</Label>
                    <Input 
                      type="password"
                      value={formData.credentials.auth_token || ""} 
                      onChange={(e) => handleCredentialChange('auth_token', e.target.value)}
                      required 
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={isLoading}>Back</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect & Sync
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
