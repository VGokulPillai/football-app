import LiveTacticalBoard from "../components/LiveTacticalBoard";

export default function Simulation() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display tracking-wider text-white uppercase">
          Live match planning
        </h1>
        <p className="text-white/60 mt-1 max-w-3xl">
          Vertical pitch view: FC Barcelona (bottom) vs next-opponent style XI (top). Run the{" "}
          <strong>90-minute clock</strong>, <strong>drag players</strong> between slots to change shape, or pull from
          the bench to <strong>substitute</strong>. ML recommendations refresh in real time with the clock and sub count —
          use alongside <strong>Ask Genie</strong> for deeper tactical Q&amp;A.
        </p>
      </div>
      <LiveTacticalBoard />
    </div>
  );
}
