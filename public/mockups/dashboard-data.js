// Read-only, request-fresh league data shared by the dashboard design studies.
window.dashboardData = fetch("/api/mockups/dashboard", { cache: "no-store" }).then(async (response) => {
  if (!response.ok) throw new Error("Unable to load current league data. Refresh to try again.");
  return response.json();
});
