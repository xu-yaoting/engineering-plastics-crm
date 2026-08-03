# Domestic-First Shipment Design

## Goal

Make the shipment workflow efficient for frequent domestic express and logistics records while preserving complete sea and air freight details.

## List

The shipment list shows shipment number, order, company, transport type, carrier, waybill/reference number, ship date, status, and actions. ETD, ETA, and vessel are removed from the list and remain available in details.

Carrier and reference values are resolved by transport type:

- Sea freight: carrier or vessel; tracking number or legacy reference.
- Air freight: airline or carrier; tracking number or legacy AWB.
- Express: express provider or carrier; tracking number.
- Logistics: carrier; tracking number.
- Pickup: no carrier or reference required.

## Form

- Express is the default transport type.
- Sea freight records carrier/forwarder, bill of lading number, container, vessel, voyage, ETD, and ETA.
- Air freight records airline/forwarder, air waybill number, ETD, and ETA.
- Express records provider, tracking number, and estimated delivery date.
- Logistics records logistics company, waybill number, and estimated delivery date.
- Pickup records pickup address and uses the common ship/pickup date.

## Detail And Edit

The detail summary uses the same type-aware carrier and reference values as the list. The detail information and edit dialog expose all fields relevant to the selected transport type, including ETD and ETA for sea and air freight.

## Compatibility

No database migration is needed. Existing `awb`, `airline`, `express_provider`, `carrier`, `vessel`, and date fields remain readable; new common reference values use `tracking_number` with legacy AWB fallback.
