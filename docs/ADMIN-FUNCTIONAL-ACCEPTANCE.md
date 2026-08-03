# ADMIN FUNCTIONAL ACCEPTANCE

> **2026-08-03** full runtime acceptance.

| Area                                 | Result                | Evidence                                     |
| ------------------------------------ | --------------------- | -------------------------------------------- |
| Admin/Manager/SuperAdmin/Staff login | PASS_BROWSER          | Playwright rbac-roles 5/5                    |
| Cửa hàng & kho list                  | PASS_BROWSER          | HCM-NGUYEN-HUE + CRUD                        |
| Store create/edit                    | PASS_BROWSER          | HN-ACCEPT-01 created                         |
| Store disable/re-enable              | PASS_BROWSER + API    | INACTIVE badge; pickup filter                |
| Staff mutation                       | PASS_API_ONLY         | POST **403**                                 |
| Audit Nhật ký                        | PASS_BROWSER          | `inventory.store.updated` row                |
| Media upload/link                    | PASS_RUNTIME          | media:audit 10/10; browser upload not re-run |
| Orders pickup badge                  | PASS_BROWSER (source) | customer pickup order created                |
