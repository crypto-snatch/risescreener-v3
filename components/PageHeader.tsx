import type {ReactNode} from "react";

export default function PageHeader({eyebrow="RISE / RISEx",title,description,cadence="Auto refresh · 30s",children}:{
  eyebrow?:string;title:string;description?:string;cadence?:string;children?:ReactNode;
}) {
  return <header className="page-heading">
    <div><div className="page-eyebrow">{eyebrow}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div>
    <div className="page-heading-actions">{children}<span className="refresh-label"><i />{cadence}</span></div>
  </header>;
}
