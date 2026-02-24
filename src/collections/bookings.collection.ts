/**
 * Bookings Collection
 *
 * Venue reservations for Family Fun in Bmore
 */

import type { CollectionConfig } from "@sonicjs-cms/core";

export default {
  name: "bookings",
  displayName: "Bookings",
  description: "Venue booking reservations",
  icon: "📅",

  schema: {
    type: "object",
    properties: {
      venueId: {
        type: "string",
        title: "Venue ID",
        required: true,
      },
      venueName: {
        type: "string",
        title: "Venue Name",
        required: true,
      },
      eventName: {
        type: "string",
        title: "Event Name",
        required: true,
      },
      eventType: {
        type: "select",
        title: "Event Type",
        enum: [
          "birthday_party", "family_reunion", "baby_shower",
          "wedding_reception", "community_meeting", "youth_group",
          "religious_gathering", "corporate_event", "other"
        ],
        enumLabels: [
          "Birthday Party", "Family Reunion", "Baby Shower",
          "Wedding Reception", "Community Meeting", "Youth Group",
          "Religious Gathering", "Corporate Event", "Other"
        ],
        required: true,
      },
      eventDate: {
        type: "string",
        title: "Event Date",
        required: true,
      },
      startTime: {
        type: "string",
        title: "Start Time",
        required: true,
      },
      duration: {
        type: "number",
        title: "Duration (hours)",
        required: true,
      },
      adultCount: {
        type: "number",
        title: "Number of Adults",
        required: true,
      },
      childCount: {
        type: "number",
        title: "Number of Children",
      },
      needsKitchen: {
        type: "boolean",
        title: "Kitchen Needed",
      },
      needsGymnasium: {
        type: "boolean",
        title: "Gymnasium Needed",
      },
      alcoholRequested: {
        type: "select",
        title: "Alcohol",
        enum: ["none", "beer_wine", "full_bar"],
        enumLabels: ["No Alcohol", "Beer & Wine Only", "Full Bar"],
      },
      contactName: {
        type: "string",
        title: "Contact Name",
        required: true,
      },
      contactEmail: {
        type: "string",
        title: "Contact Email",
        required: true,
      },
      contactPhone: {
        type: "string",
        title: "Contact Phone",
        required: true,
      },
      organization: {
        type: "string",
        title: "Organization",
      },
      specialRequests: {
        type: "textarea",
        title: "Special Requests",
      },
      estimatedTotal: {
        type: "number",
        title: "Estimated Total ($)",
      },
      status: {
        type: "select",
        title: "Booking Status",
        enum: ["pending", "confirmed", "cancelled", "completed"],
        enumLabels: ["Pending", "Confirmed", "Cancelled", "Completed"],
        default: "pending",
      },
    },
    required: ["venueId", "venueName", "eventName", "eventType", "eventDate", "startTime", "duration", "adultCount", "contactName", "contactEmail", "contactPhone"],
  },

  listFields: ["eventName", "venueName", "eventDate", "contactName", "status"],
  searchFields: ["eventName", "venueName", "contactName", "contactEmail"],
  defaultSort: "createdAt",
  defaultSortOrder: "desc",

  managed: true,
  isActive: true,
} satisfies CollectionConfig;
