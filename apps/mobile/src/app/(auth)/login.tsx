import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { z } from "zod";

import { mobileLoginRequestSchema } from "@finhealth/contracts";
import { ApiError } from "@/api/client";
import { Button, Card, ScreenScroll, TextField } from "@/components/ui";
import { useAuth } from "@/auth/auth-provider";
import { colors, commonStyles, spacing } from "@/theme/tokens";

const loginFormSchema = mobileLoginRequestSchema;
type LoginForm = z.infer<typeof loginFormSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await signIn(values);
      router.replace("/(tabs)/transactions");
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "Unable to sign in right now.");
    }
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenScroll contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
        <View style={{ gap: spacing.sm }}>
          <Text selectable style={{ color: colors.primary, fontSize: 34, fontWeight: "800", letterSpacing: -1 }}>FinHealth</Text>
          <Text selectable style={commonStyles.subtitle}>Your everyday money, in one calm place.</Text>
        </View>
        <Card style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <Text selectable style={commonStyles.sectionTitle}>Sign in</Text>
            <Text selectable style={commonStyles.subtitle}>Use the same credentials as the FinHealth web app.</Text>
          </View>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Email"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                error={errors.email?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Password"
                autoCapitalize="none"
                autoComplete="password"
                placeholder="Your password"
                secureTextEntry
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                error={errors.password?.message}
              />
            )}
          />
          {serverError ? <Text selectable style={{ color: colors.danger, lineHeight: 20 }}>{serverError}</Text> : null}
          <Button onPress={onSubmit} loading={isSubmitting}>Sign in</Button>
        </Card>
        <Text selectable style={{ color: colors.textMuted, fontSize: 13, textAlign: "center" }}>
          Registration and account security settings remain available on the web app.
        </Text>
      </ScreenScroll>
    </KeyboardAvoidingView>
  );
}
