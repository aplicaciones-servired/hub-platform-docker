import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, type TextInputProps } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

interface InputProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  isPassword?: boolean;
  error?: string;
  keyboardType?: "default" | "email-address" | "numeric";
  autoComplete?: "off" | "username" | "password" | "new-password" | "current-password";
  onBlur?: TextInputProps["onBlur"];
  onFocus?: TextInputProps["onFocus"];
}

export default function Input({
  label,
  placeholder,
  value,
  onChangeText,
  isPassword = false,
  error,
  keyboardType = "default",
  autoComplete = "off",
  onBlur,
  onFocus,
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={{ marginBottom: 14, width: "100%" }}>
      <Text style={{ fontSize: 14, color: "#111827", marginBottom: 4, marginLeft: 4 }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 58,
          borderRadius: 14,
          backgroundColor: "#FFFFFF",
          borderWidth: 1,
          borderColor: error ? "#EF4444" : "#E5E7EB",
          paddingHorizontal: 16,
        }}
      >
        <TextInput
          style={{
            flex: 1,
            fontSize: 16,
            color: "#111827",
          }}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          onFocus={onFocus}
          secureTextEntry={isPassword && !showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          testID="password-field"
          editable={true}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {showPassword ? (
              <EyeOff size={20} color="#9CA3AF" strokeWidth={1.75} />
            ) : (
              <Eye size={20} color="#9CA3AF" strokeWidth={1.75} />
            )}
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text style={{ color: "#EF4444", fontSize: 12, marginTop: 4, marginLeft: 4 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}