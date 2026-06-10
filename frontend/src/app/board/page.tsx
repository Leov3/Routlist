import { AudioBoard } from "@/components/audio-board/AudioBoard";
import { ProtectedPage } from "@/components/layout/ProtectedPage";

export default function BoardPage() {
  return (
    <ProtectedPage requiredPermissions={["board:use"]}>
      <AudioBoard />
    </ProtectedPage>
  );
}
