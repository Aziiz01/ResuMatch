/**
 * EmailJS — same service/key as Contact form.
 * https://www.emailjs.com/
 *
 * The app sends a full formatted body in `message` (and duplicates in `text`, `email_body`)
 * so templates that only use a single field still receive rating, name, and project.
 *
 * Recommended template:
 * Subject: {{subject}}
 * Body: {{message}}
 *
 * Optional extras: {{from_name}} {{from_email}} {{rating}} {{project}} {{stars_label}} {{feedback}}
 */
export const EMAILJS_CONFIG = {
  serviceId: "service_zolr81d",
  templateId: "template_g1jwi9b",
  publicKey: "xwznJDRYsjRBRkwLw",
} as const;
