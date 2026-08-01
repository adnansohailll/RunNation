import { IconUsers } from "./icons.jsx";
import EmptyStatePage from "./EmptyStatePage.jsx";

export default function Instructors() {
  return (
    <EmptyStatePage
      title="Instructors"
      message="No instructors have joined the roster yet — check back soon."
      icon={<IconUsers />}
    />
  );
}
