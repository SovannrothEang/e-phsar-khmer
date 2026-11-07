import EducationForm, {
  type EducationFormValue,
} from "@/components/account/resume/EducationForm";
import ExperienceStep, {
  type ExperienceErrors,
} from "@/components/account/resume/ExperienceStep";
import JobPreferencesForm from "@/components/account/resume/JobPreferencesForm";
import LevelForm, {
  type LevelFormValue,
} from "@/components/account/resume/LevelForm";
import ListStep from "@/components/account/resume/ListStep";
import PersonalStep, {
  type PersonalErrors,
} from "@/components/account/resume/PersonalStep";
import ReferencesStep, {
  type ReferenceErrors,
} from "@/components/account/resume/ReferencesStep";
import ResumeFeedback from "@/components/account/resume/ResumeFeedback";
import ResumeFooter from "@/components/account/resume/ResumeFooter";
import ResumeHeader from "@/components/account/resume/ResumeHeader";
import ResumeOverview from "@/components/account/resume/ResumeOverview";
import ResumeReadyDialog from "@/components/account/resume/ResumeReadyDialog";
import ResumeStart from "@/components/account/resume/ResumeStart";
import TextStep from "@/components/account/resume/TextStep";
import {
  documentToDraft,
  emptyDraft,
  EMPTY_LOCATION,
  experienceFromWire,
  personalFromWire,
  referenceFromWire,
  type ExperienceDraft,
  type JobPreferenceDraft,
  type PersonalDraft,
  type ReferenceDraft,
  type ResumeDraft,
} from "@/components/account/resume/draft";
import {
  HOBBIES_HELPER,
  STEP_TITLES,
  SUMMARY_HELPER,
} from "@/components/account/resume/options";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api/client";
import {
  completeResumeAttachment,
  createResumeAttachment,
  deleteResumeAttachment,
  deleteResumeEntry,
  deleteResumeUpload,
  fetchResume,
  isValidResumeEmail,
  isValidResumePhone,
  isValidYearsOfExperience,
  monthYearToDate,
  RESUME_CV_MAX_BYTES,
  RESUME_CV_MIME_BY_EXTENSION,
  resumeCvExtension,
  resumeCvFileName,
  saveResumeEducation,
  saveResumeExperience,
  saveResumeHobbies,
  saveResumeJobPreferences,
  saveResumeLanguage,
  saveResumePersonal,
  saveResumeReference,
  saveResumeSkill,
  saveResumeSummary,
  signResumeAttachment,
  signResumeUpload,
  type ResumeEducation,
  type ResumeLanguage,
  type ResumeSkill,
} from "@/lib/api/resume";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useColorScheme } from "nativewind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

type Phase = "loading" | "start" | "wizard" | "overview" | "feedback" | "error";

type FormState =
  | { kind: "education"; initial: ResumeEducation | null }
  | { kind: "skill"; initial: ResumeSkill | null }
  | { kind: "language"; initial: ResumeLanguage | null }
  | { kind: "jobPreferences" };

type ListSection =
  | "experiences"
  | "educations"
  | "skills"
  | "languages"
  | "references";

function upsertBy<T extends { id: string }>(list: T[], entry: T): T[] {
  const exists = list.some((item) => item.id === entry.id);
  return exists
    ? list.map((item) => (item.id === entry.id ? entry : item))
    : [...list, entry];
}

function apiMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Please try again.";
}

/** The native document picker rejects when the user backs out; not an error. */
function isPickerCancelled(error: unknown): boolean {
  const record = error as { code?: string; message?: string } | null;
  const message =
    record?.message ?? (error instanceof Error ? error.message : "");
  const code = record?.code ?? "";
  return /cancel/i.test(message) || /cancel/i.test(code);
}

export default function ResumeScreen() {
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const resumeQuery = useQuery({
    queryKey: ["resume"],
    queryFn: fetchResume,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const [phase, setPhase] = useState<Phase>("loading");
  const [draft, setDraft] = useState<ResumeDraft | null>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [returnToOverview, setReturnToOverview] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const unsavedPhotoPath = useRef<string | null>(null);
  const draftBeforeEdit = useRef<ResumeDraft | null>(null);

  const fallbackFirst = user.firstName ?? "";
  const fallbackLast = user.lastName ?? "";

  // The un-saved photo path lives in a ref so an unmount (including the iOS
  // swipe-back gesture) can still clear the uploaded object.
  useEffect(() => {
    unsavedPhotoPath.current = draft?.personal.photoPath ?? null;
  }, [draft?.personal.photoPath]);

  useEffect(
    () => () => {
      const path = unsavedPhotoPath.current;
      if (path) void deleteResumeUpload(path).catch(() => {});
    },
    [],
  );

  // Seed the phase and editable draft from the first resume fetch. Both are
  // derived from query data, so they are adjusted during render instead of from
  // an effect; a failed first fetch can still recover when the query succeeds.
  if (!hydrated) {
    if (resumeQuery.isError) {
      if (phase !== "error") setPhase("error");
    } else if (resumeQuery.isSuccess) {
      setHydrated(true);
      if (resumeQuery.data) {
        setDraft(
          documentToDraft(resumeQuery.data, fallbackFirst, fallbackLast),
        );
        setHasSaved(true);
        setPhase("overview");
      } else {
        setDraft(emptyDraft(fallbackFirst, fallbackLast));
        setPhase("start");
      }
    }
  }

  const updatePersonal = useCallback((patch: Partial<PersonalDraft>) => {
    setDraft((current) =>
      current
        ? { ...current, personal: { ...current.personal, ...patch } }
        : current,
    );
  }, []);

  const updateExperience = useCallback((patch: Partial<ExperienceDraft>) => {
    setDraft((current) =>
      current && current.experience
        ? {
            ...current,
            experience: { ...current.experience, ...patch },
          }
        : current,
    );
  }, []);

  const updateReference = useCallback((patch: Partial<ReferenceDraft>) => {
    setDraft((current) =>
      current && current.reference
        ? { ...current, reference: { ...current.reference, ...patch } }
        : current,
    );
  }, []);

  const ensureDraftForStep = useCallback((next: number) => {
    if (next === 3) {
      setDraft((current) =>
        current && !current.experience
          ? {
              ...current,
              experience: {
                id: Crypto.randomUUID(),
                company: "",
                position: "",
                place: EMPTY_LOCATION,
                start: null,
                end: null,
                current: false,
                description: "",
              },
            }
          : current,
      );
    }
    if (next === 8) {
      setDraft((current) =>
        current && !current.reference
          ? {
              ...current,
              reference: {
                id: Crypto.randomUUID(),
                name: "",
                company: "",
                position: "",
                phones: [""],
                email: "",
              },
            }
          : current,
      );
    }
  }, []);

  const goToStep = useCallback(
    (next: number) => {
      ensureDraftForStep(next);
      setStep(next);
      setShowErrors(false);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    },
    [ensureDraftForStep],
  );

  const exitToOverview = useCallback(() => {
    setPhase("overview");
    setReturnToOverview(false);
    setShowErrors(false);
  }, []);

  const finishOverviewEdit = useCallback(() => {
    draftBeforeEdit.current = null;
    exitToOverview();
  }, [exitToOverview]);

  const cancelOverviewEdit = useCallback(() => {
    const snapshot = draftBeforeEdit.current;
    const currentPath = draft?.personal.photoPath;
    // A photo picked during this edit and then discarded must not be orphaned.
    if (currentPath && currentPath !== snapshot?.personal.photoPath) {
      void deleteResumeUpload(currentPath).catch(() => {});
    }
    if (snapshot) setDraft(snapshot);
    draftBeforeEdit.current = null;
    exitToOverview();
  }, [draft?.personal.photoPath, exitToOverview]);

  const startOverviewEdit = useCallback(
    (next: number) => {
      draftBeforeEdit.current = draft;
      ensureDraftForStep(next);
      setReturnToOverview(true);
      setStep(next);
      setShowErrors(false);
      setPhase("wizard");
    },
    [draft, ensureDraftForStep],
  );

  const closeScreen = useCallback(() => {
    const path = draft?.personal.photoPath;
    if (path) void deleteResumeUpload(path).catch(() => {});
    router.back();
  }, [draft?.personal.photoPath]);

  const handleBack = useCallback(() => {
    if (form) {
      setForm(null);
      return;
    }
    if (phase === "feedback") {
      setPhase("overview");
      return;
    }
    if (phase === "overview") {
      closeScreen();
      return;
    }
    if (phase !== "wizard") {
      closeScreen();
      return;
    }
    if (returnToOverview) {
      cancelOverviewEdit();
      return;
    }
    if (step === 1) {
      closeScreen();
      return;
    }
    goToStep(step - 1);
  }, [
    form,
    phase,
    step,
    closeScreen,
    cancelOverviewEdit,
    goToStep,
    returnToOverview,
  ]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [handleBack]);

  const personalErrors: PersonalErrors = useMemo(() => {
    if (!showErrors || !draft) return {};
    const personal = draft.personal;
    const phoneRows = personal.phones.map((phone) =>
      phone.trim() !== "" && !isValidResumePhone(phone)
        ? "Please enter a valid phone number."
        : undefined,
    );
    const hasPhone = personal.phones.some((phone) => phone.trim() !== "");
    return {
      firstName:
        personal.firstName.trim() === ""
          ? "Please enter your first name."
          : undefined,
      lastName:
        personal.lastName.trim() === ""
          ? "Please enter your last name."
          : undefined,
      phoneRows,
      phoneGroup: !hasPhone
        ? "At least one phone number is required."
        : undefined,
      email:
        personal.email.trim() !== "" && !isValidResumeEmail(personal.email)
          ? "Please enter a valid email address."
          : undefined,
      years:
        personal.yearsOfExperience.trim() !== "" &&
        !isValidYearsOfExperience(personal.yearsOfExperience)
          ? "Please enter a realistic number of years (0–60)."
          : undefined,
    };
  }, [showErrors, draft]);

  const experienceDraft = draft?.experience;
  const experienceErrors: ExperienceErrors = useMemo(() => {
    if (!showErrors || !experienceDraft) return {};
    const experience = experienceDraft;
    const endMissing = !experience.current && experience.end === null;
    const orderInvalid =
      !experience.current &&
      experience.start !== null &&
      experience.end !== null &&
      experience.end.year * 12 + experience.end.month <
        experience.start.year * 12 + experience.start.month;
    return {
      company:
        experience.company.trim() === ""
          ? "Please enter the company."
          : undefined,
      position:
        experience.position.trim() === ""
          ? "Please enter the position."
          : undefined,
      start:
        experience.start === null ? "Please select a start date." : undefined,
      end: endMissing
        ? "Please select an end date."
        : orderInvalid
          ? "End date must be after the start date."
          : undefined,
    };
  }, [showErrors, experienceDraft]);

  const referenceDraft = draft?.reference;
  const referenceErrors: ReferenceErrors = useMemo(() => {
    if (!showErrors || !referenceDraft) return {};
    const reference = referenceDraft;
    const phoneRows = reference.phones.map((phone) =>
      phone.trim() !== "" && !isValidResumePhone(phone)
        ? "Please enter a valid phone number."
        : undefined,
    );
    const hasPhone = reference.phones.some((phone) => phone.trim() !== "");
    return {
      name: reference.name.trim() === "" ? "Please enter the name." : undefined,
      company:
        reference.company.trim() === ""
          ? "Please enter the company."
          : undefined,
      position:
        reference.position.trim() === ""
          ? "Please enter the position."
          : undefined,
      phoneRows,
      phoneGroup: !hasPhone
        ? "At least one phone number is required."
        : undefined,
      email:
        reference.email.trim() !== "" && !isValidResumeEmail(reference.email)
          ? "Please enter a valid email address."
          : undefined,
    };
  }, [showErrors, referenceDraft]);

  const savePersonalStep = async () => {
    if (!draft) return;
    const personal = draft.personal;
    const hasPhone = personal.phones.some((phone) => phone.trim() !== "");
    const phonesValid = personal.phones.every(
      (phone) => phone.trim() === "" || isValidResumePhone(phone),
    );
    const emailValid =
      personal.email.trim() === "" || isValidResumeEmail(personal.email);
    const yearsValid =
      personal.yearsOfExperience.trim() === "" ||
      isValidYearsOfExperience(personal.yearsOfExperience);

    if (
      personal.firstName.trim() === "" ||
      personal.lastName.trim() === "" ||
      !hasPhone ||
      !phonesValid ||
      !emailValid ||
      !yearsValid
    ) {
      setShowErrors(true);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setSaving(true);
    try {
      const saved = await saveResumePersonal({
        firstName: personal.firstName,
        lastName: personal.lastName,
        gender: personal.gender,
        dob: personal.dob,
        nationality: personal.nationality,
        email: personal.email,
        educationLevel: personal.educationLevel,
        maritalStatus: personal.maritalStatus,
        place: personal.place,
        address: personal.address,
        position: personal.position,
        yearsOfExperience: personal.yearsOfExperience,
        phones: personal.phones,
        photoUrl: personal.photoUrl,
      });
      setDraft((current) =>
        current ? { ...current, personal: personalFromWire(saved) } : current,
      );
      setHasSaved(true);
      setShowErrors(false);
      if (returnToOverview) finishOverviewEdit();
      else goToStep(2);
    } catch (error) {
      Alert.alert("Couldn't save", apiMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const saveSummaryStep = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveResumeSummary(draft.summary);
      setHasSaved(true);
      setShowErrors(false);
      if (returnToOverview) finishOverviewEdit();
      else goToStep(3);
    } catch (error) {
      Alert.alert("Couldn't save", apiMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const saveHobbiesStep = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveResumeHobbies(draft.hobbies);
      setHasSaved(true);
      setShowErrors(false);
      if (returnToOverview) finishOverviewEdit();
      else goToStep(8);
    } catch (error) {
      Alert.alert("Couldn't save", apiMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const saveExperienceStep = async () => {
    if (!draft?.experience) return;
    const experience = draft.experience;
    const endMissing = !experience.current && experience.end === null;
    const orderInvalid =
      !experience.current &&
      experience.start !== null &&
      experience.end !== null &&
      experience.end.year * 12 + experience.end.month <
        experience.start.year * 12 + experience.start.month;
    if (
      experience.company.trim() === "" ||
      experience.position.trim() === "" ||
      experience.start === null ||
      endMissing ||
      orderInvalid
    ) {
      setShowErrors(true);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setSaving(true);
    try {
      const saved = await saveResumeExperience(experience.id, {
        company: experience.company,
        position: experience.position,
        place: experience.place,
        startDate: monthYearToDate(experience.start) as string,
        endDate: experience.current ? null : monthYearToDate(experience.end),
        current: experience.current,
        description: experience.description,
      });
      setDraft((current) =>
        current
          ? { ...current, experience: experienceFromWire(saved) }
          : current,
      );
      setHasSaved(true);
      setShowErrors(false);
      if (returnToOverview) finishOverviewEdit();
      else goToStep(4);
    } catch (error) {
      Alert.alert("Couldn't save", apiMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const finishReference = async () => {
    if (!draft?.reference) return;
    const reference = draft.reference;
    const hasPhone = reference.phones.some((phone) => phone.trim() !== "");
    const phonesValid = reference.phones.every(
      (phone) => phone.trim() === "" || isValidResumePhone(phone),
    );
    const emailValid =
      reference.email.trim() === "" || isValidResumeEmail(reference.email);
    if (
      reference.name.trim() === "" ||
      reference.company.trim() === "" ||
      reference.position.trim() === "" ||
      !hasPhone ||
      !phonesValid ||
      !emailValid
    ) {
      setShowErrors(true);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setSaving(true);
    try {
      const saved = await saveResumeReference(reference.id, {
        name: reference.name,
        company: reference.company,
        position: reference.position,
        phones: reference.phones,
        email: reference.email,
      });
      setDraft((current) =>
        current ? { ...current, reference: referenceFromWire(saved) } : current,
      );
      setHasSaved(true);
      setShowErrors(false);
      if (returnToOverview) finishOverviewEdit();
      else setReady(true);
    } catch (error) {
      Alert.alert("Couldn't save", apiMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const skipReference = () => {
    if (returnToOverview) {
      finishOverviewEdit();
      return;
    }
    if (hasSaved) setReady(true);
    else closeScreen();
  };

  const saveEducationForm = async (
    value: EducationFormValue,
  ): Promise<boolean> => {
    try {
      const saved = await saveResumeEducation(value.id, {
        school: value.school,
        degree: value.degree,
        major: value.major,
        startDate: value.startDate,
        endDate: value.endDate,
        current: value.current,
        description: value.description,
      });
      setDraft((current) =>
        current
          ? { ...current, educations: upsertBy(current.educations, saved) }
          : current,
      );
      setHasSaved(true);
      return true;
    } catch (error) {
      Alert.alert("Couldn't save", apiMessage(error));
      return false;
    }
  };

  const saveLevelForm = async (
    kind: "skill" | "language",
    value: LevelFormValue,
  ): Promise<boolean> => {
    try {
      if (kind === "skill") {
        const saved = await saveResumeSkill(value.id, value.title, value.level);
        setDraft((current) =>
          current
            ? { ...current, skills: upsertBy(current.skills, saved) }
            : current,
        );
      } else {
        const saved = await saveResumeLanguage(
          value.id,
          value.title,
          value.level,
        );
        setDraft((current) =>
          current
            ? { ...current, languages: upsertBy(current.languages, saved) }
            : current,
        );
      }
      setHasSaved(true);
      return true;
    } catch (error) {
      Alert.alert("Couldn't save", apiMessage(error));
      return false;
    }
  };

  const confirmDelete = (section: ListSection, entry: { id: string }) => {
    Alert.alert("Delete entry", "Remove this entry from your resume?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteResumeEntry(section, entry.id);
              setDraft((current) => {
                if (!current) return current;
                if (section === "experiences") {
                  return { ...current, experience: null };
                }
                if (section === "references") {
                  return { ...current, reference: null };
                }
                if (section === "educations") {
                  return {
                    ...current,
                    educations: current.educations.filter(
                      (item) => item.id !== entry.id,
                    ),
                  };
                }
                if (section === "skills") {
                  return {
                    ...current,
                    skills: current.skills.filter(
                      (item) => item.id !== entry.id,
                    ),
                  };
                }
                return {
                  ...current,
                  languages: current.languages.filter(
                    (item) => item.id !== entry.id,
                  ),
                };
              });
            } catch (error) {
              Alert.alert("Couldn't delete", apiMessage(error));
            }
          })();
        },
      },
    ]);
  };

  const saveJobPreferenceForm = async (
    value: JobPreferenceDraft,
  ): Promise<boolean> => {
    try {
      await saveResumeJobPreferences(value);
      setDraft((current) =>
        current ? { ...current, jobPreference: value } : current,
      );
      setHasSaved(true);
      return true;
    } catch (error) {
      Alert.alert("Couldn't save", apiMessage(error));
      return false;
    }
  };

  const showEntryMenu = (
    title: string,
    onEdit: () => void,
    onDelete: () => void,
  ) => {
    Alert.alert(title, undefined, [
      { text: "Edit", onPress: onEdit },
      { text: "Delete", style: "destructive", onPress: onDelete },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const openAttachment = async () => {
    try {
      const url = await signResumeAttachment();
      if (!url) {
        Alert.alert("Couldn't open the CV", "Please try again.");
        return;
      }
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      Alert.alert("Couldn't open the CV", apiMessage(error));
    }
  };

  const removeAttachment = async () => {
    try {
      await deleteResumeAttachment();
      setDraft((current) =>
        current ? { ...current, attachment: null } : current,
      );
    } catch (error) {
      Alert.alert("Couldn't remove the CV", apiMessage(error));
    }
  };

  const showAttachmentActions = () => {
    const attachment = draft?.attachment;
    if (!attachment) return;
    Alert.alert(attachment.fileName, undefined, [
      { text: "Open", onPress: () => void openAttachment() },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void removeAttachment(),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Photo permission",
        "Allow photo access to upload a resume photo.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) {
      Alert.alert("Photo too large", "Choose an image up to 5 MB.");
      return;
    }
    const mime = asset.mimeType ?? "image/jpeg";
    if (!mime.startsWith("image/")) {
      Alert.alert("Unsupported photo", "Choose an image file.");
      return;
    }

    setPhotoUploading(true);
    try {
      const signed = await signResumeUpload(
        asset.fileName ?? `resume-${Date.now()}.jpg`,
      );
      const fileResponse = await fetch(asset.uri);
      const blob = await fileResponse.blob();
      const upload = await fetch(signed.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": mime },
        body: blob,
      });
      if (!upload.ok) throw new Error("The photo upload was refused.");

      const previousPath = draft?.personal.photoPath;
      updatePersonal({
        photoUrl: signed.publicUrl,
        photoPath: signed.path,
      });
      if (previousPath && previousPath !== signed.path) {
        void deleteResumeUpload(previousPath).catch(() => {});
      }
    } catch (error) {
      Alert.alert(
        "Couldn't upload your photo",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  const pickCv = async () => {
    if (cvUploading) return;

    try {
      const picked = await File.pickFileAsync();
      const file = Array.isArray(picked) ? picked[0] : picked;
      if (!file) return;

      const extension = resumeCvExtension(file.uri, file.type);
      if (!extension || !file.size || file.size > RESUME_CV_MAX_BYTES) {
        Alert.alert(
          "Unsupported file",
          "Choose a doc, DOCX, PDF or txt file (max 5MB).",
        );
        return;
      }

      const fileName = resumeCvFileName(file.uri, extension);
      const mime = RESUME_CV_MIME_BY_EXTENSION[extension];

      setCvUploading(true);
      const id = Crypto.randomUUID();
      const ticket = await createResumeAttachment({
        id,
        fileName,
        declaredSize: Math.round(file.size),
      });
      const bytes = await file.bytes();
      const upload = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mime },
        body: bytes,
      });
      if (!upload.ok) throw new Error("The CV upload was refused.");

      const completed = await completeResumeAttachment(id);
      setDraft((current) =>
        current
          ? {
              ...current,
              attachment: {
                id: completed.id,
                fileName,
                size: completed.size,
                uploadedAt: new Date().toISOString(),
              },
            }
          : current,
      );
    } catch (error) {
      if (isPickerCancelled(error)) return;
      Alert.alert(
        "Couldn't upload your CV",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setCvUploading(false);
    }
  };

  const startWizard = () => {
    setDraft((current) => current ?? emptyDraft(fallbackFirst, fallbackLast));
    draftBeforeEdit.current = null;
    setPhase("wizard");
    setStep(1);
    setShowErrors(false);
    setReturnToOverview(false);
    setForm(null);
  };

  const retry = async () => {
    setPhase("loading");
    const result = await resumeQuery.refetch();
    if (!result.isSuccess) setPhase("error");
  };

  const barColor = isDark ? "#171717" : "#FFFFFF";

  const formTitle =
    form?.kind === "education"
      ? "Educations"
      : form?.kind === "skill"
        ? "Skill"
        : form?.kind === "language"
          ? "Language"
          : form?.kind === "jobPreferences"
            ? "Job Preferences"
            : "";

  const stepBody = (() => {
    if (!draft) return null;
    if (step === 1) {
      return (
        <PersonalStep
          draft={draft.personal}
          onChange={updatePersonal}
          errors={personalErrors}
          photoUploading={photoUploading}
          onPickPhoto={pickPhoto}
        />
      );
    }
    if (step === 2) {
      return (
        <TextStep
          label="Summary"
          helper={SUMMARY_HELPER}
          value={draft.summary}
          onChangeText={(summary) =>
            setDraft((current) => (current ? { ...current, summary } : current))
          }
          maxLength={1000}
        />
      );
    }
    if (step === 3 && draft.experience) {
      return (
        <ExperienceStep
          draft={draft.experience}
          onChange={updateExperience}
          errors={experienceErrors}
        />
      );
    }
    if (step === 4) {
      return (
        <ListStep
          section="educations"
          educations={draft.educations}
          skills={draft.skills}
          languages={draft.languages}
          onAdd={() => setForm({ kind: "education", initial: null })}
          onEdit={(entry) =>
            setForm({ kind: "education", initial: entry as ResumeEducation })
          }
          onDelete={(entry) => confirmDelete("educations", entry)}
        />
      );
    }
    if (step === 5) {
      return (
        <ListStep
          section="skills"
          educations={draft.educations}
          skills={draft.skills}
          languages={draft.languages}
          onAdd={() => setForm({ kind: "skill", initial: null })}
          onEdit={(entry) =>
            setForm({ kind: "skill", initial: entry as ResumeSkill })
          }
          onDelete={(entry) => confirmDelete("skills", entry)}
        />
      );
    }
    if (step === 6) {
      return (
        <ListStep
          section="languages"
          educations={draft.educations}
          skills={draft.skills}
          languages={draft.languages}
          onAdd={() => setForm({ kind: "language", initial: null })}
          onEdit={(entry) =>
            setForm({ kind: "language", initial: entry as ResumeLanguage })
          }
          onDelete={(entry) => confirmDelete("languages", entry)}
        />
      );
    }
    if (step === 7) {
      return (
        <TextStep
          label="Hobbies & Interests"
          helper={HOBBIES_HELPER}
          value={draft.hobbies}
          onChangeText={(hobbies) =>
            setDraft((current) => (current ? { ...current, hobbies } : current))
          }
          maxLength={1000}
        />
      );
    }
    if (step === 8 && draft.reference) {
      return (
        <ReferencesStep
          draft={draft.reference}
          onChange={updateReference}
          errors={referenceErrors}
        />
      );
    }
    return null;
  })();

  const footer = (() => {
    if (step === 1) {
      return (
        <ResumeFooter
          primaryLabel={returnToOverview ? "Save" : "Next → Summary"}
          onPrimary={savePersonalStep}
          saving={saving}
        />
      );
    }
    if (step === 2) {
      return (
        <ResumeFooter
          primaryLabel={returnToOverview ? "Save" : "Next → Experience"}
          onPrimary={saveSummaryStep}
          onSkip={returnToOverview ? undefined : () => goToStep(3)}
          saving={saving}
        />
      );
    }
    if (step === 3) {
      return (
        <ResumeFooter
          primaryLabel="Save"
          onPrimary={saveExperienceStep}
          onSkip={returnToOverview ? undefined : () => goToStep(4)}
          saving={saving}
        />
      );
    }
    if (step === 4) {
      return (
        <ResumeFooter
          primaryLabel="Next → Skill"
          onPrimary={() => goToStep(5)}
        />
      );
    }
    if (step === 5) {
      return (
        <ResumeFooter
          primaryLabel="Next → Languages"
          onPrimary={() => goToStep(6)}
        />
      );
    }
    if (step === 6) {
      return (
        <ResumeFooter
          primaryLabel="Next → Hobbies & Interests"
          onPrimary={() => goToStep(7)}
        />
      );
    }
    if (step === 7) {
      return (
        <ResumeFooter
          primaryLabel={returnToOverview ? "Save" : "Next → References"}
          onPrimary={saveHobbiesStep}
          onSkip={returnToOverview ? undefined : () => goToStep(8)}
          saving={saving}
        />
      );
    }
    return (
      <ResumeFooter
        primaryLabel="Save"
        onPrimary={finishReference}
        onSkip={returnToOverview ? undefined : skipReference}
        saving={saving}
      />
    );
  })();

  return (
    <SafeAreaView
      className="flex-1 bg-white dark:bg-black"
      statusBarColor={barColor}
      statusBarStyle={isDark ? "light-content" : "dark-content"}
    >
      {phase === "loading" ? (
        <>
          <ResumeHeader
            title="Resume (CV)"
            onBack={() => router.back()}
            align="center"
          />
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={Colors.primary.DEFAULT} />
          </View>
        </>
      ) : phase === "error" ? (
        <>
          <ResumeHeader
            title="Resume (CV)"
            onBack={() => router.back()}
            align="center"
          />
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="cloud-offline-outline" size={44} color="#9CA3AF" />
            <Text className="mt-3 text-center text-base text-gray-500 dark:text-gray-400">
              Could not load your resume. Check your connection and try again.
            </Text>
            <TouchableOpacity
              onPress={retry}
              className="mt-4 rounded-lg bg-primary px-6 py-2.5"
              accessibilityRole="button"
              accessibilityLabel="Retry"
            >
              <Text className="font-bold text-white">Retry</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : phase === "start" || !draft ? (
        <ResumeStart onStart={startWizard} onBack={closeScreen} />
      ) : (
        <>
          {form ? (
            <ResumeHeader
              title={formTitle}
              onBack={() => setForm(null)}
              align="center"
            />
          ) : phase === "overview" ? (
            <ResumeHeader
              title="Resume (CV)"
              onBack={closeScreen}
              align="center"
              right={
                <TouchableOpacity
                  onPress={() => startOverviewEdit(1)}
                  activeOpacity={0.7}
                  className="h-10 w-10 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Edit resume"
                >
                  <Ionicons
                    name="create-outline"
                    size={22}
                    color={isDark ? "#FFFFFF" : "#111827"}
                  />
                </TouchableOpacity>
              }
            />
          ) : phase === "feedback" ? (
            <ResumeHeader
              title="Feedback"
              onBack={() => setPhase("overview")}
              align="center"
            />
          ) : (
            <ResumeHeader
              title={STEP_TITLES[step - 1]}
              step={returnToOverview ? undefined : step}
              onBack={handleBack}
              close={!returnToOverview && step === 1}
            />
          )}

          {form ? (
            form.kind === "education" ? (
              <EducationForm
                key={`education-${form.initial?.id ?? "new"}`}
                initial={form.initial}
                onSave={saveEducationForm}
                onClose={() => setForm(null)}
              />
            ) : form.kind === "skill" ? (
              <LevelForm
                key={`skill-${form.initial?.id ?? "new"}`}
                kind="skill"
                initial={form.initial}
                onSave={(value) => saveLevelForm("skill", value)}
                onClose={() => setForm(null)}
              />
            ) : form.kind === "language" ? (
              <LevelForm
                key={`language-${form.initial?.id ?? "new"}`}
                kind="language"
                initial={form.initial}
                onSave={(value) => saveLevelForm("language", value)}
                onClose={() => setForm(null)}
              />
            ) : (
              <JobPreferencesForm
                initial={draft.jobPreference}
                onSave={saveJobPreferenceForm}
                onClose={() => setForm(null)}
              />
            )
          ) : phase === "overview" ? (
            <ScrollView
              ref={scrollRef}
              className="flex-1"
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              showsVerticalScrollIndicator={false}
            >
              <ResumeOverview
                draft={draft}
                scrollRef={scrollRef}
                onEditPersonal={() => startOverviewEdit(1)}
                onEditStep={startOverviewEdit}
                onAddEducation={() =>
                  setForm({ kind: "education", initial: null })
                }
                onEditEducation={(entry) =>
                  setForm({ kind: "education", initial: entry })
                }
                onDeleteEducation={(entry) =>
                  confirmDelete("educations", entry)
                }
                onAddSkill={() => setForm({ kind: "skill", initial: null })}
                onEditSkill={(entry) =>
                  setForm({ kind: "skill", initial: entry })
                }
                onDeleteSkill={(entry) => confirmDelete("skills", entry)}
                onAddLanguage={() =>
                  setForm({ kind: "language", initial: null })
                }
                onEditLanguage={(entry) =>
                  setForm({ kind: "language", initial: entry })
                }
                onDeleteLanguage={(entry) => confirmDelete("languages", entry)}
                onDeleteExperience={() => {
                  if (draft.experience) {
                    confirmDelete("experiences", draft.experience);
                  }
                }}
                onDeleteReference={() => {
                  if (draft.reference) {
                    confirmDelete("references", draft.reference);
                  }
                }}
                onEntryMenu={showEntryMenu}
                onEditJobPreferences={() => setForm({ kind: "jobPreferences" })}
                onAttachmentActions={showAttachmentActions}
                cvUploading={cvUploading}
                onUploadCv={pickCv}
              />
            </ScrollView>
          ) : phase === "feedback" ? (
            <ResumeFeedback
              name={`${draft.personal.firstName} ${draft.personal.lastName}`.trim()}
              phone={
                draft.personal.phones.find((value) => value.trim() !== "") ?? ""
              }
              email={
                isValidResumeEmail(draft.personal.email)
                  ? draft.personal.email
                  : ""
              }
              onDone={() => setPhase("overview")}
            />
          ) : (
            <KeyboardAvoidingView
              className="flex-1"
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <ScrollView
                ref={scrollRef}
                className="flex-1"
                contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {stepBody}
              </ScrollView>
              {footer}
            </KeyboardAvoidingView>
          )}
        </>
      )}

      <ResumeReadyDialog
        visible={ready}
        onFinish={() => {
          setReady(false);
          setPhase("overview");
          setReturnToOverview(false);
        }}
        onFeedback={() => {
          setReady(false);
          setPhase("feedback");
        }}
      />
    </SafeAreaView>
  );
}
