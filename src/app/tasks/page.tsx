import Protected from "@/components/Protected";

export default function TasksPage() {
  return (
    <Protected>
      <div className="p-6">
        <h1 className="text-xl font-semibold">Tasks</h1>
        <p className="opacity-70">Protected placeholder page.</p>
      </div>
    </Protected>
  );
}
