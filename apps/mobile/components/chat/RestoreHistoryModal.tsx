import { Colors } from "@/constants/Colors";
import type { RestoreResult } from "@/lib/e2e/backup";
import { MIN_PASSCODE_LENGTH } from "@/lib/e2e/backup-crypto";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface RestoreHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (passcode: string) => Promise<RestoreResult>;
  onRestored: (restored: number) => void;
}

/**
 * The passcode prompt for a device that does not hold the account backup key
 * yet. It is opened from the locked-messages banner, never as a page of its
 * own — the prompt only exists where there are messages it could unlock.
 */
export default function RestoreHistoryModal({
  visible,
  onClose,
  onSubmit,
  onRestored,
}: RestoreHistoryModalProps) {
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setPasscode("");
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (passcode.length < MIN_PASSCODE_LENGTH) {
      setError(
        `The backup passcode is at least ${MIN_PASSCODE_LENGTH} characters.`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await onSubmit(passcode);
      if (result.ok) {
        setPasscode("");
        onRestored(result.restored);
        return;
      }
      switch (result.reason) {
        case "wrong":
          setError(
            `Wrong passcode. ${result.attemptsLeft} attempt${
              result.attemptsLeft === 1 ? "" : "s"
            } left.`,
          );
          break;
        case "locked": {
          const when = result.lockedUntil
            ? new Date(result.lockedUntil).toLocaleTimeString()
            : "later";
          setError(`Too many attempts. Try again after ${when}.`);
          break;
        }
        case "no-passcode":
          setError("This account has no backup passcode yet.");
          break;
        case "no-backup":
          setError("This account has no chat-history backup.");
          break;
        default:
          setError(
            result.reason === "error"
              ? result.message
              : "Could not restore the backup.",
          );
      }
    } catch {
      setError("Could not reach the backup. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 items-center justify-center bg-black/40 px-6"
      >
        <View className="w-full rounded-2xl bg-white p-5">
          <Text className="text-lg font-bold text-neutral-text-main">
            Restore chat history
          </Text>
          <Text className="mt-1.5 text-sm leading-5 text-neutral-text-sub">
            Enter the backup passcode you set on the web. The history downloads
            encrypted and is decrypted only on this phone. A message none of
            your devices had opened before is not in the backup.
          </Text>

          <TextInput
            value={passcode}
            onChangeText={setPasscode}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Backup passcode"
            placeholderTextColor={Colors.text.muted}
            editable={!busy}
            className="mt-4 rounded-lg border border-neutral-border bg-white px-4 py-3 text-base text-neutral-text-main"
          />

          {error && (
            <Text className="mt-2 text-xs leading-4 text-red-600">{error}</Text>
          )}

          <View className="mt-5 flex-row justify-end gap-3">
            <TouchableOpacity
              onPress={close}
              disabled={busy}
              className="rounded-lg px-4 py-2.5"
            >
              <Text className="font-semibold text-neutral-text-sub">
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void submit()}
              disabled={busy}
              className="min-w-24 items-center rounded-lg bg-primary px-5 py-2.5"
            >
              {busy ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="font-bold text-white">Restore</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
