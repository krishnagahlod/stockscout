"use client";

import { useEffect, useState } from "react";
import { 
  getBrokerAccounts, 
  syncBrokerAccount,
  BrokerAccountData 
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Plus, Wallet, AlertCircle, CheckCircle2, ServerCrash } from "lucide-react";
import { BrokerConnectModal } from "@/components/portfolio/broker-connect-modal";
import { toast } from "sonner";

export default function BrokerAccountsPage() {
  const [accounts, setAccounts] = useState<BrokerAccountData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const data = await getBrokerAccounts();
      setAccounts(data);
    } catch (error) {
      console.error("Failed to load broker accounts:", error);
      toast.error("Error", {
        description: "Failed to load connected accounts",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSync = async (accountId: number) => {
    // Optimistic UI update
    setAccounts(prev => prev.map(acc => 
      acc.id === accountId ? { ...acc, sync_status: "syncing" } : acc
    ));
    
    try {
      await syncBrokerAccount(accountId);
      toast.success("Sync Initiated", {
        description: "Your holdings are being synchronized in the background.",
      });
      // In a real app we'd poll or use websocket, here we'll just wait a bit and refresh
      setTimeout(fetchAccounts, 3000);
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error("Sync Failed", {
        description: "Failed to start synchronization.",
      });
      fetchAccounts(); // Revert optimistic update
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'syncing': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error': return <ServerCrash className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Connected Accounts</h1>
          <p className="text-muted-foreground mt-1">
            Manage your broker connections and synchronize your holdings.
          </p>
        </div>
        
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Connect Broker
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : accounts.length === 0 ? (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Accounts Connected</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mb-6">
              Connect your Zerodha, Dhan, or Groww account to automatically track your investments and get AI-powered insights.
            </p>
            <Button onClick={() => setIsModalOpen(true)} variant="outline">
              Connect Your First Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map(account => (
            <Card key={account.id} className="relative overflow-hidden transition-all hover:shadow-md">
              <div className={`absolute top-0 left-0 w-1 h-full bg-primary`} />
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{account.account_label}</CardTitle>
                    <CardDescription className="capitalize mt-1 font-medium text-foreground/80">
                      {account.broker_name}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {account.account_purpose.replace('_', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Holdings</p>
                    <p className="font-semibold">{account.holdings_count}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Current Value</p>
                    <p className="font-semibold">{formatCurrency(account.total_current_value)}</p>
                  </div>
                </div>
                
                <div className="bg-muted/50 p-3 rounded-lg flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(account.sync_status)}
                    <span className="capitalize">{account.sync_status}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {account.last_synced_at ? new Date(account.last_synced_at).toLocaleString() : 'Never synced'}
                  </span>
                </div>
              </CardContent>
              
              <CardFooter>
                <Button 
                  variant="secondary" 
                  className="w-full"
                  disabled={account.sync_status === 'syncing'}
                  onClick={() => handleSync(account.id)}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${account.sync_status === 'syncing' ? 'animate-spin' : ''}`} />
                  {account.sync_status === 'syncing' ? 'Syncing...' : 'Sync Now'}
                </Button>
              </CardFooter>
            </Card>
          ))}
          
          {/* Add New Account Card */}
          <Card className="border-dashed flex items-center justify-center bg-transparent hover:bg-muted/30 transition-colors cursor-pointer min-h-[250px]" onClick={() => setIsModalOpen(true)}>
            <div className="flex flex-col items-center text-muted-foreground">
              <Plus className="h-10 w-10 mb-2" />
              <p className="font-medium">Connect Another Account</p>
            </div>
          </Card>
        </div>
      )}

      <BrokerConnectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchAccounts();
        }}
      />
    </div>
  );
}
