import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap page-h" style={{ paddingBottom: 80 }}>
      <h1>Nothing here · Nada por acá</h1>
      <p>This page does not exist. Esta página no existe.</p>
      <p style={{ marginTop: 16 }}>
        <Link className="btn" href="/">Pipette</Link>
      </p>
    </div>
  );
}
