import { IconRoute } from "./icons.jsx";
import EmptyStatePage from "./EmptyStatePage.jsx";

export default function Races() {
  return (
    <EmptyStatePage
      title="Races"
      message="The starting line is quiet for now — no races on the calendar yet."
      icon={<IconRoute />}
    />
  );
}
