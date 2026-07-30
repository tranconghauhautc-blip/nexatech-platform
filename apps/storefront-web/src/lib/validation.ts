import { z } from 'zod';

export {
  loginRequestSchema,
  registerRequestSchema,
} from '@nexatech/shared-contracts';
export type { LoginRequest, RegisterRequest } from '@nexatech/shared-contracts';

export const forgotPasswordRequestSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
});
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

export const resetPasswordRequestSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
  code: z
    .string()
    .trim()
    .min(4, 'Mã xác nhận không hợp lệ')
    .max(12, 'Mã xác nhận không hợp lệ'),
  newPassword: z
    .string()
    .min(8, 'Mật khẩu tối thiểu 8 ký tự')
    .max(128, 'Mật khẩu tối đa 128 ký tự'),
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

export const verifyEmailRequestSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
  code: z
    .string()
    .trim()
    .min(4, 'Mã xác nhận không hợp lệ')
    .max(12, 'Mã xác nhận không hợp lệ'),
});
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

export const registerFormSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Vui lòng nhập họ tên').max(120),
    email: z.string().trim().email('Email không hợp lệ'),
    password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(128),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
    agreeTerms: z.literal(true, {
      errorMap: () => ({ message: 'Bạn cần đồng ý với điều khoản sử dụng' }),
    }),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });
export type RegisterFormValues = z.infer<typeof registerFormSchema>;

export const loginFormSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});
export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const profileFormSchema = z.object({
  fullName: z.string().trim().min(1, 'Vui lòng nhập họ tên').max(120),
  phone: z
    .string()
    .trim()
    .regex(/^(0|\+84)[0-9]{8,10}$/, 'Số điện thoại không hợp lệ')
    .optional()
    .or(z.literal('')),
});
export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const addressFormSchema = z.object({
  recipientName: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên người nhận')
    .max(120),
  recipientPhone: z
    .string()
    .trim()
    .regex(/^(0|\+84)[0-9]{8,10}$/, 'Số điện thoại không hợp lệ'),
  line1: z.string().trim().min(1, 'Vui lòng nhập địa chỉ').max(250),
  line2: z.string().trim().max(250).optional().or(z.literal('')),
  ward: z.string().trim().max(120).optional().or(z.literal('')),
  district: z.string().trim().max(120).optional().or(z.literal('')),
  city: z.string().trim().min(1, 'Vui lòng nhập tỉnh/thành phố').max(120),
  province: z.string().trim().max(120).optional().or(z.literal('')),
  postalCode: z.string().trim().max(20).optional().or(z.literal('')),
});
export type AddressFormValues = z.infer<typeof addressFormSchema>;

/** Địa chỉ trong sổ địa chỉ khách hàng (customer-service) — khác field name với địa chỉ đơn hàng. */
export const customerAddressFormSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Vui lòng đặt tên địa chỉ (VD: Nhà riêng)')
    .max(60),
  recipient: z.string().trim().min(1, 'Vui lòng nhập tên người nhận').max(120),
  phone: z
    .string()
    .trim()
    .regex(/^(0|\+84)[0-9]{8,10}$/, 'Số điện thoại không hợp lệ'),
  line1: z.string().trim().min(1, 'Vui lòng nhập địa chỉ').max(250),
  line2: z.string().trim().max(250).optional().or(z.literal('')),
  ward: z.string().trim().max(120).optional().or(z.literal('')),
  district: z.string().trim().max(120).optional().or(z.literal('')),
  city: z.string().trim().min(1, 'Vui lòng nhập tỉnh/thành phố').max(120),
  postalCode: z.string().trim().max(20).optional().or(z.literal('')),
  isDefault: z.boolean().optional(),
});
export type CustomerAddressFormValues = z.infer<
  typeof customerAddressFormSchema
>;

export const supportTicketFormSchema = z.object({
  category: z.enum([
    'ORDER',
    'PRODUCT',
    'PAYMENT',
    'SHIPPING',
    'WARRANTY',
    'ACCOUNT',
    'OTHER',
  ]),
  subject: z.string().trim().min(5, 'Tiêu đề tối thiểu 5 ký tự').max(200),
  description: z.string().trim().min(10, 'Mô tả tối thiểu 10 ký tự').max(5000),
  orderId: z.string().trim().max(120).optional().or(z.literal('')),
});
export type SupportTicketFormValues = z.infer<typeof supportTicketFormSchema>;

export function flattenZodErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    if (!result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}
