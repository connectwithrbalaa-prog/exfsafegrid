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
import CustomerPortal from "./pages/CustomerPortal";
import AgentDesktop from "./pages/AgentDesktop";
import CommandCenter from "./pages/CommandCenter";
import DemoPresentation from "./pages/DemoPresentation";
import Documentation from "./pages/Documentation";
import PspsStatus from "./pages/PspsStatus";
import FieldCrewApp from "./pages/FieldCrewApp";
import PspsSimulator from "./pages/PspsSimulator";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRouter from "./components/RoleRouter";

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
              <Route path="/" element={<Index />} />
              <Route path="/customer" element={<ProtectedRoute requiredRole="customer"><CustomerPortal /></ProtectedRoute>} />
              <Route path="/agent" element={<ProtectedRoute requiredRole="agent"><AgentDesktop /></ProtectedRoute>} />
              <Route path="/command-center" element={<ProtectedRoute requiredRole="executive"><CommandCenter /></ProtectedRoute>} />
              <Route path="/field-crew" element={<ProtectedRoute requiredRole="field"><FieldCrewApp /></ProtectedRoute>} />
              <Route path="/crew" element={<ProtectedRoute requiredRole="field"><FieldCrewApp /></ProtectedRoute>} />
              <Route path="/psps-simulator" element={<ProtectedRoute requiredRole="executive"><PspsSimulator /></ProtectedRoute>} />
              <Route path="/demo" element={<DemoPresentation />} />
              <Route path="/docs" element={<Documentation />} />
              <Route path="/status" element={<PspsStatus />} />
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
