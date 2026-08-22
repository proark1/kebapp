import { FlaskConical } from "lucide-react";

export function DemoEnvironmentBar() {
  return (
    <div className="demo-environment-bar" role="status">
      <FlaskConical aria-hidden="true" size={15} />
      <strong>Öffentliche Demo</strong>
      <span>Beispieldaten · kein E-Mail-Versand</span>
    </div>
  );
}
