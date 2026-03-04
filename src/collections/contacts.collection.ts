/**
 * Contacts Collection
 *
 * Contact form submissions for Family Fun in Bmore
 */

import type { CollectionConfig } from "@sonicjs-cms/core";

export default {
  name: "contacts",
  displayName: "Contact Submissions",
  description: "Contact form submissions from the website",
  icon: "✉️",

  schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        title: "Name",
        required: true,
      },
      email: {
        type: "string",
        title: "Email",
        required: true,
      },
      subject: {
        type: "select",
        title: "Subject",
        enum: ["general", "booking", "venue", "partnership", "feedback"],
        enumLabels: ["General Inquiry", "Booking Help", "Venue Question", "Venue Partnership", "Feedback"],
      },
      message: {
        type: "textarea",
        title: "Message",
        required: true,
      },
      status: {
        type: "select",
        title: "Status",
        enum: ["new", "read", "replied"],
        enumLabels: ["New", "Read", "Replied"],
        default: "new",
      },
    },
    required: ["name", "email", "message"],
  },

  listFields: ["name", "email", "subject", "status"],
  searchFields: ["name", "email", "message"],
  defaultSort: "createdAt",
  defaultSortOrder: "desc",

  managed: true,
  isActive: true,
} satisfies CollectionConfig;
