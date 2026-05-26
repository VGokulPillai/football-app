import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import AudiencePrediction from "./pages/AudiencePrediction";
import RevenueOptimization from "./pages/RevenueOptimization";
import PlayerPerformance from "./pages/PlayerPerformance";
import HealthMonitoring from "./pages/HealthMonitoring";
import TransferIntelligence from "./pages/TransferIntelligence";
import MediaIntelligence from "./pages/MediaIntelligence";
import Simulation from "./pages/Simulation";
import FootballData from "./pages/FootballData";
import VisionScouting from "./pages/VisionScouting";
function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ExecutiveDashboard />} />
        <Route path="/audience" element={<AudiencePrediction />} />
        <Route path="/revenue" element={<RevenueOptimization />} />
        <Route path="/players" element={<PlayerPerformance />} />
        <Route path="/health" element={<HealthMonitoring />} />
        <Route path="/transfers" element={<TransferIntelligence />} />
        <Route path="/media" element={<MediaIntelligence />} />
        <Route path="/simulation" element={<Simulation />} />
        <Route path="/football" element={<FootballData />} />
        <Route path="/vision-scouting" element={<VisionScouting />} />
      </Routes>
    </Layout>
  );
}

export default App;
