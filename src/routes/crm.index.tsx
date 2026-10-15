import React, { useState, useEffect } from "react";
import { useLightCrmPage } from "@/lib/crm-theme";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CrmApp } from "@/components/crm/crm-app";
import { getStoredCrmUser, CrmUser } from "@/lib/crm-auth";

export const Route = createFileRoute("/crm/")({
  head: () => ({
    meta: [
      { title: "AI STUDIO INDIA – Enterprise CRM" },
      { name: "description", content: "Quickupp AI Studio India Enterprise CRM Dashboard" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CrmDashboardPage,
});

function CrmDashboardPage() {
  const navigate = useNavigate();
  useLightCrmPage();
  const [currentUser, setCurrentUser] = useState<CrmUser | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const user = getStoredCrmUser();
    if (!user) {
      navigate({ to: "/crm/login" });
    } else {
      setCurrentUser(user);
      setIsChecking(false);
    }
  }, [navigate]);

  if (isChecking || !currentUser) {
    return (
      <div className="min-h-screen bg-[#f4f5f9] flex flex-col items-center justify-center p-4 text-slate-500 text-xs">
        <div className="w-6 h-6 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-3"></div>
        <span>Verifying Enterprise CRM Session...</span>
      </div>
    );
  }

  return <CrmApp user={currentUser} />;
}
