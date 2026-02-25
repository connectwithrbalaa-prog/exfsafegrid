import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CustomerProvider } from "@/hooks/use-customer";
import ErrorBoundary from "@/components/ErrorBoundary";
import MlChatBubble from "@/components/MlChatBubble";
import Index from "./pages/Index";
import Login from "./pages/Login";
import CommandCenter from "./pages/CommandCenter";
import DemoPresentation from "./pages/DemoPresentation";
import Documentation from "./pages/Documentation";
import PspsStatus from "./pages/PspsStatus";
import FieldCrewApp from "./pages/FieldCrewApp";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CustomerProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/docs" element={<Documentation />} />
              <Route path="/" element={<Index />} />
              <Route path="/command-center" element={<CommandCenter />} />
              <Route path="/demo" element={<DemoPresentation />} />
              <Route path="/status" element={<PspsStatus />} />
              <Route path="/crew" element={<FieldCrewApp />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <MlChatBubble />
          </ErrorBoundary>
        </BrowserRouter>
      </CustomerProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
