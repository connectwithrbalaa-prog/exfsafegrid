import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CustomerProvider } from "@/hooks/use-customer";
import ErrorBoundary from "@/components/ErrorBoundary";
import MlChatBubble from "@/components/MlChatBubble";
import Index from "./pages/Index";
import Login from "./pages/Login";
import CustomerPortal from "./pages/CustomerPortal";
import AgentDesktop from "./pages/AgentDesktop";
import CommandCenter from "./pages/CommandCenter";
import CommandCenterLayout from "./components/command-center/CommandCenterLayout";
import ExecutiveWorkspace from "./pages/command-center/ExecutiveWorkspace";
import GisWorkspace from "./pages/command-center/GisWorkspace";
import PlanningWorkspace from "./pages/command-center/PlanningWorkspace";
import DemoPresentation from "./pages/DemoPresentation";
import Documentation from "./pages/Documentation";
import PspsStatus from "./pages/PspsStatus";
import FieldCrewApp from "./pages/FieldCrewApp";
import PspsSimulator from "./pages/PspsSimulator";
import Playbooks from "./pages/Playbooks";
import Notifications from "./pages/Notifications";
import AssetStrategyView from "./pages/AssetStrategyView";
import Replay from "./pages/Replay";
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

              {/* Command Center — workspace subroutes */}
              <Route path="/command-center" element={<ProtectedRoute requiredRole="executive"><CommandCenterLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="executive" replace />} />
                <Route path="executive" element={<CommandCenter />} />
                <Route path="wildfire" element={<ExecutiveWorkspace />} />
                <Route path="gis" element={<GisWorkspace />} />
                <Route path="planning" element={<PlanningWorkspace />} />
              </Route>

              <Route path="/field-crew" element={<ProtectedRoute requiredRole="field"><FieldCrewApp /></ProtectedRoute>} />
              <Route path="/crew" element={<ProtectedRoute requiredRole="field"><FieldCrewApp /></ProtectedRoute>} />
              <Route path="/psps-simulator" element={<ProtectedRoute requiredRole="executive"><PspsSimulator /></ProtectedRoute>} />
              <Route path="/playbooks" element={<ProtectedRoute requiredRole="executive"><Playbooks /></ProtectedRoute>} />
              <Route path="/replay" element={<ProtectedRoute requiredRole="executive"><Replay /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute requiredRole="executive"><Notifications /></ProtectedRoute>} />
              <Route path="/planning/assets" element={<ProtectedRoute requiredRole="executive"><AssetStrategyView /></ProtectedRoute>} />
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
