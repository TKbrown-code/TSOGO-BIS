import { useState } from "react";
import "../../styles/loadingUX.css";

export default function LoadingUX() {
  const [loading, setLoading] = useState(true);

  return (
    <>
      {loading && <div className="loading"></div>}
    </>
  );
}
