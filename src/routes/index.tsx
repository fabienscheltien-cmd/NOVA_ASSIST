import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nova Assist" },
      { name: "description", content: "Nova Assist" },
      { property: "og:title", content: "Nova Assist" },
      { property: "og:description", content: "Nova Assist" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main>
      <h1>Nova Assist</h1>
    </main>
  );
}
