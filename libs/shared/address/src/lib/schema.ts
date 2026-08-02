import { z } from 'zod';
import { validateAddressSelection } from './validate';

/** Vietnamese mobile/landline in local (0xxxxxxxxx) or +84 international form. */
export const VIETNAM_PHONE_REGEX = /^(0\d{9}|\+84\d{9})$/;

/**
 * Vietnam address form schema. Matches the fields collected by
 * VietnamAddressSelector: label?, recipientName, phone, provinceCode,
 * wardCode, addressLine1, addressLine2?, isDefault?.
 *
 * provinceCode/wardCode are always selected from the administrative
 * dataset (never free-typed), and are cross-validated against it here.
 */
export const vietnamAddressFormSchema = z
  .object({
    label: z
      .string()
      .trim()
      .max(50, 'Nhãn địa chỉ không được vượt quá 50 ký tự')
      .optional(),
    recipientName: z
      .string()
      .trim()
      .min(2, 'Vui lòng nhập tên người nhận')
      .max(120, 'Tên người nhận không được vượt quá 120 ký tự'),
    phone: z
      .string()
      .trim()
      .regex(VIETNAM_PHONE_REGEX, 'Số điện thoại không hợp lệ'),
    provinceCode: z.string().trim().min(1, 'Vui lòng chọn tỉnh/thành phố'),
    wardCode: z.string().trim().min(1, 'Vui lòng chọn phường/xã'),
    addressLine1: z
      .string()
      .trim()
      .min(3, 'Vui lòng nhập địa chỉ cụ thể (số nhà, tên đường)')
      .max(200, 'Địa chỉ không được vượt quá 200 ký tự'),
    addressLine2: z
      .string()
      .trim()
      .max(200, 'Địa chỉ không được vượt quá 200 ký tự')
      .optional(),
    isDefault: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const result = validateAddressSelection({
      provinceCode: value.provinceCode,
      wardCode: value.wardCode,
    });
    if (!result.valid) {
      const message = result.errors[0] ?? 'Địa chỉ hành chính không hợp lệ';
      const path =
        message.includes('phường/xã') || message.includes('Phường/xã')
          ? ['wardCode']
          : ['provinceCode'];
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
    }
  });

export type VietnamAddressFormValues = z.infer<typeof vietnamAddressFormSchema>;
