import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import {
  mobileCreateTransactionSchema,
  mobileTransactionTypeSchema,
  mobileUpdateTransactionSchema,
  type MobileAccount,
  type MobileTransaction,
  type MobileTransactionType,
} from "@finhealth/contracts";
import { getAccounts } from "@/api/accounts";
import { getCategories } from "@/api/categories";
import { ApiError } from "@/api/client";
import { createTransaction, scanTransactionReceipt, updateTransaction } from "@/api/transactions";
import { ModalPicker, type PickerOption } from "@/components/modal-picker";
import { Button, Card, Field, OfflineBanner, SelectField, TextField } from "@/components/ui";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { createClientMutationId, formatMoney } from "@/features/transactions/format";
import { LocationPickerModal } from "@/features/transactions/location-picker-modal";
import { prepareReceiptImage } from "@/features/receipt-scan/prepare-receipt";
import { colors, radii, spacing } from "@/theme/tokens";

const formSchema = z.object({
  type: mobileTransactionTypeSchema,
  amount: z.string().min(1, "Amount is required"),
  currency: z.string().min(1),
  exchangeRate: z.string().min(1),
  date: z.string().min(1, "Date is required"),
  accountId: z.string().min(1, "Account is required"),
  toAccountId: z.string(),
  categoryId: z.string(),
  description: z.string(),
  location: z.string(),
  latitude: z.string(),
  longitude: z.string(),
  googleMapsLink: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

interface TransactionFormProps {
  mode: "create" | "edit";
  transaction?: MobileTransaction;
  onSaved: (transaction: MobileTransaction) => void;
}

const supportedTypes: Array<{ value: MobileTransactionType; label: string }> = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
  { value: "TRANSFER", label: "Transfer" },
];

const transferAccountTypes = new Set<MobileAccount["type"]>([
  "BANK",
  "CASH",
  "INVESTMENT",
]);

function initialValues(transaction?: MobileTransaction): FormValues {
  const transactionType = transaction?.type;
  const type: MobileTransactionType = transactionType === "INCOME" || transactionType === "EXPENSE" || transactionType === "TRANSFER"
    ? transactionType
    : "EXPENSE";
  return {
    type,
    amount: transaction ? String(transaction.amount) : "",
    currency: transaction?.currency ?? "",
    exchangeRate: transaction ? String(transaction.exchangeRate) : "1",
    date: transaction?.date ?? new Date().toISOString(),
    accountId: transaction?.account.id ?? "",
    toAccountId: transaction?.toAccount?.id ?? "",
    categoryId: transaction?.category?.id ?? "",
    description: transaction?.description ?? "",
    location: transaction?.location ?? "",
    latitude: transaction?.latitude === null || transaction?.latitude === undefined ? "" : String(transaction.latitude),
    longitude: transaction?.longitude === null || transaction?.longitude === undefined ? "" : String(transaction.longitude),
    googleMapsLink: transaction?.googleMapsLink ?? "",
  };
}

export function TransactionForm({ mode, transaction, onSaved }: TransactionFormProps) {
  const queryClient = useQueryClient();
  const isOnline = useNetworkStatus();
  const [picker, setPicker] = useState<"account" | "destination" | "category" | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrNotice, setOcrNotice] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const mutationIdRef = useRef<string | null>(null);
  const scanSequenceRef = useRef(0);
  const { control, handleSubmit, setValue, watch, formState: { dirtyFields, errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues(transaction),
  });

  const type = watch("type");
  const accountId = watch("accountId");
  const destinationId = watch("toAccountId");
  const categoryId = watch("categoryId");
  const dateValue = watch("date");
  const latitudeValue = watch("latitude");
  const longitudeValue = watch("longitude");
  const locationValue = watch("location");
  const accountsQuery = useQuery({ queryKey: ["accounts"], queryFn: getAccounts });
  const categoriesQuery = useQuery({
    queryKey: ["categories", type],
    queryFn: () => getCategories(type === "TRANSFER" ? undefined : type),
    enabled: type !== "TRANSFER",
  });
  const mutation = useMutation({
    mutationFn: async (payload: z.infer<typeof mobileCreateTransactionSchema> | z.infer<typeof mobileUpdateTransactionSchema>) => {
      if (mode === "create") return createTransaction(payload as z.infer<typeof mobileCreateTransactionSchema>);
      return updateTransaction(transaction?.id ?? "", payload as z.infer<typeof mobileUpdateTransactionSchema>);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (mode === "create") mutationIdRef.current = null;
      onSaved(saved);
    },
  });

  const accounts = accountsQuery.data?.accounts ?? [];
  const activeOrCurrentAccounts = accounts.filter((account) =>
    account.isActive || account.id === transaction?.account.id || account.id === transaction?.toAccount?.id,
  );
  const sourceAccount = accounts.find((account) => account.id === accountId);
  const destinationAccount = accounts.find((account) => account.id === destinationId);
  const selectedCategory = categoriesQuery.data?.categories.find((category) => category.id === categoryId);

  const changeTransactionType = (nextType: MobileTransactionType) => {
    if (nextType === type) return;
    setValue("type", nextType);
    setValue("categoryId", "");
    setValue("toAccountId", "");
    if (
      nextType === "TRANSFER" &&
      sourceAccount &&
      !transferAccountTypes.has(sourceAccount.type)
    ) {
      setValue("accountId", "");
      setValue("currency", "");
    }
  };

  useEffect(() => {
    if (mode === "create" && !accountId && activeOrCurrentAccounts.length > 0) {
      const firstActive = activeOrCurrentAccounts.find(
        (account) =>
          account.isActive &&
          account.type !== "DEPOSITO" &&
          (type !== "TRANSFER" || transferAccountTypes.has(account.type))
      );
      if (firstActive) {
        setValue("accountId", firstActive.id);
        setValue("currency", firstActive.currency);
      }
    }
  }, [accountId, activeOrCurrentAccounts, mode, setValue, type]);

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    if (!isOnline) {
      setSubmitError("Connect to the internet before saving a transaction.");
      return;
    }
    const amount = Number(values.amount.replace(/,/g, ""));
    const exchangeRate = Number(values.exchangeRate.replace(/,/g, ""));
    const latitude = values.latitude ? Number(values.latitude) : null;
    const longitude = values.longitude ? Number(values.longitude) : null;
    const locationMetadataChanged = Boolean(
      dirtyFields.latitude || dirtyFields.longitude || dirtyFields.googleMapsLink
    );
    const payload = {
      amount,
      currency: sourceAccount?.currency ?? values.currency,
      exchangeRate,
      type: values.type,
      description: values.description.trim() || (mode === "edit" ? null : undefined),
      location: values.location.trim() || (mode === "edit" ? null : undefined),
      latitude: mode === "edit"
        ? locationMetadataChanged ? latitude : undefined
        : latitude ?? undefined,
      longitude: mode === "edit"
        ? locationMetadataChanged ? longitude : undefined
        : longitude ?? undefined,
      googleMapsLink: mode === "edit"
        ? locationMetadataChanged ? values.googleMapsLink.trim() || null : undefined
        : values.googleMapsLink.trim() || undefined,
      date: new Date(values.date).toISOString(),
      accountId: values.accountId,
      toAccountId: values.type === "TRANSFER" ? values.toAccountId : null,
      categoryId:
        values.type === "INCOME" || values.type === "EXPENSE"
          ? values.categoryId || null
          : null,
    };
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      setSubmitError("Enter a valid amount and exchange rate.");
      return;
    }
    if (mode === "create") {
      if (!mutationIdRef.current) mutationIdRef.current = createClientMutationId();
      const parsed = mobileCreateTransactionSchema.safeParse({ ...payload, clientMutationId: mutationIdRef.current });
      if (!parsed.success) {
        setSubmitError(parsed.error.issues[0]?.message ?? "Check the transaction details.");
        return;
      }
      try {
        await mutation.mutateAsync(parsed.data);
      } catch (error) {
        setSubmitError(error instanceof ApiError ? error.message : "Unable to save transaction.");
      }
    } else {
      const parsed = mobileUpdateTransactionSchema.safeParse(payload);
      if (!parsed.success) {
        setSubmitError(parsed.error.issues[0]?.message ?? "Check the transaction details.");
        return;
      }
      try {
        await mutation.mutateAsync(parsed.data);
      } catch (error) {
        setSubmitError(error instanceof ApiError ? error.message : "Unable to save transaction.");
      }
    }
  });

  const openReceiptActions = () => {
    if (isScanning) return;
    Alert.alert("Scan receipt", "Choose how to add a receipt image.", [
      { text: "Take photo", onPress: () => void scanReceipt("camera") },
      { text: "Choose photo", onPress: () => void scanReceipt("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const scanReceipt = async (source: "camera" | "library") => {
    const scanSequence = ++scanSequenceRef.current;
    setIsScanning(true);
    setOcrError(null);
    setOcrNotice(null);
    try {
      const permission = source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error(
          source === "camera"
            ? "Allow camera access to photograph a receipt."
            : "Allow photo access to choose a receipt."
        );
      }
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, selectionLimit: 1 });
      if (result.canceled || !result.assets[0]) return;
      const file = await prepareReceiptImage(result.assets[0]);
      const response = await scanTransactionReceipt(file);
      if (scanSequence !== scanSequenceRef.current) return;
      const ocr = response.data;
      if (ocr.type) changeTransactionType(ocr.type);
      if (ocr.amount !== null) setValue("amount", String(ocr.amount));
      if (ocr.date) setValue("date", new Date(`${ocr.date}T12:00:00`).toISOString());
      if (ocr.description) setValue("description", ocr.description);
      if (ocr.location) setValue("location", ocr.location);
      if (ocr.categoryId) setValue("categoryId", ocr.categoryId);
      const notices = [...ocr.warnings];
      if (ocr.lineItems.length > 0) notices.push("Itemized lines were detected; edit splits on the web app.");
      if (ocr.confidence !== null) notices.push(`Scan confidence: ${Math.round(ocr.confidence * 100)}%. Review the fields before saving.`);
      setOcrNotice(notices.join(" ") || "Receipt scanned. Review the fields before saving.");
    } catch (error) {
      if (scanSequence === scanSequenceRef.current) {
        setOcrError(error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Unable to scan this receipt.");
      }
    } finally {
      if (scanSequence === scanSequenceRef.current) setIsScanning(false);
    }
  };

  const onDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== "android") setDatePickerVisible(false);
    if (event.type === "set" && date) setValue("date", date.toISOString());
    if (Platform.OS === "android") setDatePickerVisible(false);
  };

  const selectableSourceAccounts = type === "TRANSFER"
    ? activeOrCurrentAccounts.filter((account) => transferAccountTypes.has(account.type))
    : activeOrCurrentAccounts.filter((account) => account.type !== "DEPOSITO");
  const accountOptions: PickerOption[] = selectableSourceAccounts.map((account) => accountOption(account));
  const destinationOptions: PickerOption[] = activeOrCurrentAccounts
    .filter((account) =>
      account.id !== accountId &&
      transferAccountTypes.has(account.type) &&
      (!sourceAccount || account.currency === sourceAccount.currency),
    )
    .map((account) => accountOption(account));
  const categoryOptions: PickerOption[] = (categoriesQuery.data?.categories ?? []).map((category) => ({
    id: category.id,
    label: `${category.icon ? `${category.icon} ` : ""}${category.name}`,
    detail: category.type,
  }));

  return (
    <View style={{ gap: spacing.lg }}>
      <OfflineBanner isOnline={isOnline} />
      <Card style={{ gap: spacing.lg }}>
        <View style={styles.typeRow}>
          {supportedTypes.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              onPress={() => changeTransactionType(option.value)}
              style={[styles.typeOption, type === option.value && styles.typeOptionSelected]}>
              <Text selectable style={[styles.typeOptionText, type === option.value && styles.typeOptionTextSelected]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <Controller
          control={control}
          name="amount"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextField label="Amount" keyboardType="decimal-pad" placeholder="0.00" value={value} onBlur={onBlur} onChangeText={onChange} error={errors.amount?.message} />
          )}
        />
        <Field label="Date" error={errors.date?.message}>
          <Pressable accessibilityRole="button" onPress={() => setDatePickerVisible(true)} style={styles.dateField}>
            <Text selectable style={styles.dateText}>{formatDateForForm(dateValue)}</Text>
          </Pressable>
          {datePickerVisible ? <DateTimePicker value={new Date(dateValue)} mode="datetime" display="default" onChange={onDateChange} /> : null}
        </Field>
        <Controller
          control={control}
          name="accountId"
          render={() => (
            <Field label="Account" error={errors.accountId?.message}>
              <SelectField value={sourceAccount ? selectedAccountLabel(sourceAccount) : undefined} placeholder="Choose an account" onPress={() => setPicker("account")} />
            </Field>
          )}
        />
        {type === "TRANSFER" ? (
          <Controller
            control={control}
            name="toAccountId"
            render={() => (
              <Field label="Destination account" error={errors.toAccountId?.message}>
                <SelectField value={destinationAccount ? selectedAccountLabel(destinationAccount) : undefined} placeholder="Choose destination" onPress={() => setPicker("destination")} />
              </Field>
            )}
          />
        ) : (
          <Controller
            control={control}
            name="categoryId"
            render={() => (
              <Field label="Category">
                <SelectField value={selectedCategory?.name} placeholder="Choose a category (optional)" onPress={() => setPicker("category")} disabled={categoriesQuery.isLoading} />
              </Field>
            )}
          />
        )}
        <Controller
          control={control}
          name="description"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextField label="Description" placeholder="What was this for?" value={value} onBlur={onBlur} onChangeText={onChange} error={errors.description?.message} />
          )}
        />
        <Controller
          control={control}
          name="location"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextField label="Location" placeholder="Optional" value={value} onBlur={onBlur} onChangeText={onChange} error={errors.location?.message} />
          )}
        />
        <Button variant="secondary" onPress={() => setLocationPickerVisible(true)}>
          {latitudeValue && longitudeValue ? "Change map location" : "Choose on map"}
        </Button>
        {latitudeValue && longitudeValue ? (
          <View style={styles.locationSelection}>
            <View style={styles.locationSelectionCopy}>
              <Text selectable style={styles.locationSelectionTitle}>Map pin selected</Text>
              <Text selectable style={styles.locationSelectionCoordinates}>{Number(latitudeValue).toFixed(6)}, {Number(longitudeValue).toFixed(6)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setValue("latitude", "", { shouldDirty: true });
                setValue("longitude", "", { shouldDirty: true });
                setValue("googleMapsLink", "", { shouldDirty: true });
              }}>
              <Text selectable style={styles.clearLocation}>Clear pin</Text>
            </Pressable>
          </View>
        ) : null}
        {mode === "create" ? <Button variant="secondary" onPress={openReceiptActions} disabled={!isOnline || isScanning || mutation.isPending} loading={isScanning}>Scan receipt</Button> : null}
        {ocrNotice ? <Text selectable style={styles.notice}>{ocrNotice}</Text> : null}
        {ocrError ? <Text selectable style={styles.error}>{ocrError}</Text> : null}
        {submitError ? <Text selectable style={styles.error}>{submitError}</Text> : null}
        <Button onPress={submit} disabled={!isOnline || isScanning} loading={mutation.isPending}>{mode === "create" ? "Save transaction" : "Save changes"}</Button>
      </Card>
      <ModalPicker
        visible={picker === "account"}
        title="Choose account"
        options={accountOptions}
        onClose={() => setPicker(null)}
        onSelect={(option) => {
          setValue("accountId", option.id);
          const selected = accounts.find((account) => account.id === option.id);
          if (selected) {
            setValue("currency", selected.currency);
            if (destinationAccount?.currency !== selected.currency) {
              setValue("toAccountId", "");
            }
          }
          setPicker(null);
        }}
      />
      <ModalPicker
        visible={picker === "destination"}
        title="Choose destination"
        options={destinationOptions}
        onClose={() => setPicker(null)}
        onSelect={(option) => {
          setValue("toAccountId", option.id);
          setPicker(null);
        }}
      />
      <ModalPicker
        visible={picker === "category"}
        title="Choose category"
        options={[{ id: "", label: "No category" }, ...categoryOptions]}
        onClose={() => setPicker(null)}
        onSelect={(option) => {
          setValue("categoryId", option.id);
          setPicker(null);
        }}
        emptyMessage="No categories are available for this transaction type."
      />
      <LocationPickerModal
        visible={locationPickerVisible}
        initialCoordinate={latitudeValue && longitudeValue ? {
          latitude: Number(latitudeValue),
          longitude: Number(longitudeValue),
        } : undefined}
        initialLabel={locationValue}
        onClose={() => setLocationPickerVisible(false)}
        onSelect={(selection) => {
          setValue("location", selection.location, { shouldDirty: true });
          setValue("latitude", String(selection.latitude), { shouldDirty: true });
          setValue("longitude", String(selection.longitude), { shouldDirty: true });
          setValue("googleMapsLink", selection.googleMapsLink, { shouldDirty: true });
          setLocationPickerVisible(false);
        }}
      />
    </View>
  );
}

function accountOption(account: MobileAccount): PickerOption {
  return {
    id: account.id,
    label: account.name,
    detail: `${formatMoney(account.balance, account.currency)} · ${account.type.replaceAll("_", " ")}${account.isActive ? "" : " · inactive (historical only)"}`,
    disabled: !account.isActive,
  };
}

function selectedAccountLabel(account: MobileAccount) {
  return `${account.name} · ${formatMoney(account.balance, account.currency)}`;
}

function formatDateForForm(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

const styles = StyleSheet.create({
  typeRow: { flexDirection: "row", gap: spacing.sm },
  typeOption: { alignItems: "center", borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, flex: 1, paddingVertical: spacing.sm },
  typeOptionSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  typeOptionText: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  typeOptionTextSelected: { color: colors.primary },
  dateField: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: spacing.md },
  dateText: { color: colors.text, fontSize: 16 },
  locationSelection: { alignItems: "center", backgroundColor: colors.surfaceMuted, borderRadius: radii.md, flexDirection: "row", justifyContent: "space-between", padding: spacing.md },
  locationSelectionCopy: { flex: 1, gap: 2 },
  locationSelectionTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  locationSelectionCoordinates: { color: colors.textMuted, fontSize: 12 },
  clearLocation: { color: colors.danger, fontSize: 13, fontWeight: "700", padding: spacing.sm },
  notice: { backgroundColor: colors.warningSoft, borderRadius: radii.md, color: colors.warning, lineHeight: 20, padding: spacing.md },
  error: { color: colors.danger, lineHeight: 20 },
});
