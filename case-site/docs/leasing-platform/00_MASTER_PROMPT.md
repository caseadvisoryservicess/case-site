# Leasing & Sales Operating Platform — Claude Code Master Prompt

## 1. Role

You are the lead product architect, senior frontend engineer, CRM architect, commercial real estate analyst, leasing and sales operations specialist, UX designer, data-model designer, AI systems architect, and QA engineer for this project.

Build a professional HTML MVP for a commercial real estate Leasing & Sales Operating Platform.

The platform will initially be used by the internal Leasing & Sales team and later by selected property owners and clients through a restricted client portal.

The long-term platform may become part of a larger real estate operating ecosystem:

- Geoanalytics / Location Intelligence
- Project Consulting
- Property and Building Check-up
- Project Management
- Leasing and Sales
- Building OS / Digital Twin
- Facility Management
- Asset Management

The first version is a validation prototype. Do not build a production backend, production authentication, cloud infrastructure, enterprise security, payment system, or full asset/facility-management system.

Build a working HTML application that allows the team to test:

- daily leasing and sales workflow;
- CRM;
- project and building database;
- floor and unit database;
- interactive floor plans;
- merchandise mix;
- brand database;
- companies and contacts;
- leasing pipeline;
- sales pipeline;
- tasks and activities;
- documents;
- comments;
- owner/client portal;
- reporting;
- local persistence;
- import/export;
- future Geoanalytics integration;
- future AI integration;
- future Asset Management, Facility Management, and Building OS integration.

---

# 2. Core product objective

This is not merely:

- a CRM;
- a property database;
- a leasing tracker;
- a collection of floor plans;
- a reporting dashboard.

It must become the daily operating system for commercial leasing and sales.

The core model is:

```text
CRM + Property Database + Brand Database + Interactive Floor Plans
+ Leasing Pipeline + Sales Pipeline + Documents + Tasks
+ Reporting + Client Portal
```

The platform must answer questions such as:

- What projects are currently being leased or sold?
- Which units are vacant?
- Which units are under negotiation?
- Which units are leased?
- Which units are sold?
- Which brands are being negotiated for each unit?
- Which managers are responsible?
- What is the next action?
- Which follow-ups are overdue?
- Which brands match available units?
- What is the current merchandise mix?
- How does actual tenant mix compare with target tenant mix?
- What percentage of GLA is leased?
- What percentage is in active negotiation?
- What is the leasing and sales pipeline by area and value?
- Which contracts are signed?
- Which commissions are pending or received?
- What should be reported to the owner?
- What changed since the previous report?
- Which client comments require a response?
- Which files belong to the project?
- Which floor-plan units require attention?

---

# 3. Product principles

## 3.1 One source of truth

Important data must not live independently in:

- Excel files;
- Telegram chats;
- personal notebooks;
- isolated employee computers;
- separate floor plans;
- unconnected CRM lists.

The application should use one connected data model.

## 3.2 Connect the business to the building

The core hierarchy is:

```text
Client
  -> Project
    -> Site / Complex
      -> Building / Block
        -> Floor
          -> Unit
            -> Brand / Buyer
              -> Requirement
                -> Deal
                  -> Activity
                    -> Contract
                      -> Commission / Result
```

A user should be able to click a unit on the floor plan and see:

- unit number;
- area;
- status;
- target category;
- actual category;
- brand or tenant;
- deal stage;
- responsible manager;
- commercial terms;
- next action;
- comments;
- documents;
- activity history.

## 3.3 Visual management

The floor plan is an operational interface, not only an uploaded image.

Important operational information must be visible directly on the floor plan.

## 3.4 Internal and client views are different

Internal users may see:

- internal notes;
- negotiation details;
- commissions;
- private contacts;
- sensitive comments;
- staff performance;
- internal documents.

Clients must only see approved project information.

Never expose internal data merely because the object is linked to a client project.

## 3.5 No hidden state

When a unit status changes, all relevant views must remain synchronized:

- floor plan;
- unit table;
- CRM;
- dashboard;
- analytics;
- reports;
- client portal, where permitted;
- status history.

## 3.6 Future expansion

The architecture must later support:

- Asset Management;
- lease administration;
- rent roll;
- payments;
- arrears;
- NOI;
- budgets;
- CAPEX;
- Facility Management;
- work orders;
- equipment;
- inspections;
- Building OS;
- technical systems;
- Geoanalytics;
- AI tools;
- historical reporting.

Do not implement these modules now, but do not create an architecture that prevents them later.

---

# 4. Business context

The platform belongs to the commercial real estate ecosystem being developed by the company.

Current operating context:

- the founder initially acts as curator and product/business sponsor;
- the first projects are supervised by the founder;
- operational control should gradually transfer to Leasing & Sales leadership;
- Nodir Mahmudxojizoda is the operational lead for Leasing & Sales;
- future Building OS, Asset Management, and Facility Management expansion will be developed with the relevant internal team, including Beksulton Shaxriddinov;
- exact long-term role definitions can be formalized later.

The software should reduce founder dependency by making processes:

- visible;
- measurable;
- repeatable;
- assignable;
- auditable.

---

# 5. MVP scope

The MVP must include working or clearly simulated versions of:

1. Prototype login and session handling
2. Role simulation
3. Internal dashboard
4. Project database
5. Building/block database
6. Floor database
7. Unit database
8. Interactive floor plans
9. Unit status visualization
10. Merchandise-mix visualization
11. Target-versus-actual merchandise mix
12. Brand database
13. Company database
14. Contact database
15. Requirement records
16. Leasing pipeline
17. Sales pipeline
18. Tasks and activities
19. Activity timelines
20. Documents/file registry
21. Internal notes
22. Client-visible comments
23. Client/owner portal
24. Project dashboard
25. Owner reporting
26. Print/PDF report workflow
27. Import/export
28. LocalStorage persistence
29. Data validation
30. Duplicate warnings
31. Data completeness indicators
32. Stale-data indicators
33. Future Geoanalytics integration model
34. Future AI tool architecture
35. Future Asset/FМ/Building OS architecture

Do not expand the MVP into a full ERP.

---

# 6. Requirements review and corrections

Before implementation, review the source requirements and identify contradictions, risks, and over-complex features.

Apply these corrections:

## 6.1 Prototype login is not security

The MVP may include demo users and role simulation, but must clearly state:

```text
Prototype authentication only. This does not provide production security.
```

No real passwords, secrets, authentication server, or security claims are allowed.

## 6.2 File handling is local prototype handling

Do not pretend that local file metadata or browser object URLs are secure document storage.

For the MVP, use:

- demo file records;
- local metadata;
- browser object URLs where reliable;
- IndexedDB only if necessary.

Clearly document that production storage will require secure backend storage.

## 6.3 Unit status and deal stage are separate

Do not use one field for both.

A unit may be:

```text
Available
```

while it has several deals:

```text
Brand A — Viewing
Brand B — Negotiation
Brand C — Contacted
```

Deal stages describe opportunities. Unit status describes the operational state of the space.

## 6.4 A unit may have multiple prospects

Do not duplicate unit area in KPIs because multiple prospects are linked to one unit.

Inventory metrics must count unit area once.

Pipeline metrics must count deal areas according to clearly defined rules.

## 6.5 A deal may contain multiple units

A single deal may be linked to multiple units.

The application must calculate the total deal area correctly without duplicating inventory.

## 6.6 Commission completion is configurable

Commission receipt may be a required internal completion condition, but this must be configurable.

Do not hard-code one permanent financial rule.

## 6.7 Automatic floor-plan recognition is future functionality

Do not claim that OCR, CV, CAD, PDF, or AI floor-plan recognition works unless it actually works.

The HTML MVP should use:

- supplied SVG/JSON polygons;
- manual polygon mapping;
- optional experimental text extraction;
- clearly labeled experimental recognition.

## 6.8 Client visibility must be explicit

Every sensitive object or field must support a conceptual visibility level:

- Internal
- Client-visible
- Restricted
- Public / ecosystem-approved

---

# 7. Project hierarchy and entities

Use stable IDs and relational references.

Core entities:

```text
users
clients
projects
sites
buildings
floors
floorPlans
units
brands
companies
contacts
requirements
deals
tasks
activities
comments
documents
reports
settings
statusHistory
auditLog
```

The minimum hierarchy is:

```text
Client -> Project -> Building -> Floor -> Unit
```

The commercial relationship is:

```text
Brand / Buyer -> Requirement -> Opportunity / Deal -> Unit(s)
```

---

# 8. Data model

Use a central state object.

```javascript
const appState = {
  users: [],
  clients: [],
  projects: [],
  sites: [],
  buildings: [],
  floors: [],
  floorPlans: [],
  units: [],
  brands: [],
  companies: [],
  contacts: [],
  requirements: [],
  deals: [],
  tasks: [],
  activities: [],
  comments: [],
  documents: [],
  reports: [],
  settings: {},
  statusHistory: [],
  auditLog: [],
  session: null
};
```

Render all application views from this data model.

Do not hard-code business data throughout the HTML.

---

# 9. Project schema

Each project should support:

```javascript
{
  id: "PROJ-001",
  name: "Demo Project",
  alternativeNames: [],
  demoRecord: true,

  clientIds: [],
  city: null,
  country: null,
  address: null,
  latitude: null,
  longitude: null,

  assetTypes: ["Retail"],
  status: "Active",

  areas: {
    gbaM2: null,
    glaM2: null,
    leasableAreaM2: null,
    sellableAreaM2: null,
    unitCount: 0,
    floorCount: 0
  },

  commercial: {
    leasingMandateType: null,
    salesMandateType: null,
    mandateMode: "Exclusive",
    mandateStartDate: null,
    mandateExpiryDate: null,
    targetOpeningDate: null,
    targetOccupancyPercent: null,
    pricingNotes: null
  },

  team: {
    curatorId: null,
    headId: null,
    projectLeadId: null,
    leasingManagerIds: [],
    salesManagerIds: [],
    administratorId: null
  },

  notes: {
    internal: [],
    clientVisible: []
  },

  documentIds: [],
  buildingIds: [],
  floorIds: [],
  unitIds: [],

  createdAt: null,
  updatedAt: null
}
```

Required project fields:

- project ID;
- project name;
- alternative name;
- city;
- address;
- latitude;
- longitude;
- asset type;
- status;
- client/owner;
- developer;
- internal lead;
- GBA;
- GLA;
- leasable/sellable area;
- floor count;
- unit count;
- mandate information;
- project team;
- project files;
- internal notes;
- client-visible notes.

Use GLA and GBA consistently.

Do not introduce NLA/GFA unless explicitly required later.

---

# 10. Building, floor, and floor-plan schema

## Building

```javascript
{
  id: "BLDG-001",
  projectId: "PROJ-001",
  name: "Building A",
  blockCode: "A",
  status: "Operating",
  floorIds: [],
  notes: [],
  createdAt: null,
  updatedAt: null
}
```

## Floor

```javascript
{
  id: "FLOOR-001",
  projectId: "PROJ-001",
  buildingId: "BLDG-001",
  floorNumber: 1,
  name: "Ground Floor",
  floorPlanIds: [],
  unitIds: [],
  status: "Active",
  createdAt: null,
  updatedAt: null
}
```

## Floor plan

```javascript
{
  id: "PLAN-001",
  projectId: "PROJ-001",
  buildingId: "BLDG-001",
  floorId: "FLOOR-001",
  version: 1,
  fileName: "ground-floor-demo.svg",
  format: "SVG",
  effectiveDate: null,
  uploadedAt: null,
  uploadedBy: null,
  current: true,
  archived: false,
  backgroundUrl: null,
  notes: null,
  polygonMappings: []
}
```

Plan versioning must be supported conceptually.

A new plan must not silently erase historical unit, deal, or status records.

---

# 11. Unit schema

Every commercial unit must have a unique ID.

```javascript
{
  id: "UNIT-001",
  projectId: "PROJ-001",
  buildingId: "BLDG-001",
  floorId: "FLOOR-001",

  unitNumber: "F1-001",
  label: "Unit F1-001",

  geometry: {
    polygonId: "polygon-001",
    centroid: { x: 0, y: 0 },
    frontageLengthM: null,
    areaSource: "Manual / Plan / Verified"
  },

  area: {
    glaM2: 120,
    grossUnitAreaM2: null,
    mezzanineM2: null,
    terraceM2: null
  },

  targetUse: {
    category: null,
    subcategory: null,
    brandProfile: null,
    merchandiseRole: null,
    preferredUnitType: null
  },

  actualUse: {
    brandId: null,
    tenantName: null,
    category: null,
    subcategory: null
  },

  commercialStatus: "Available",

  leasingTerms: {
    askingRent: null,
    agreedRent: null,
    currency: "USD",
    rentUnit: "USD/m2/month",
    serviceCharge: null,
    vatTreatment: "Unknown",
    turnoverRent: null,
    rentFreePeriod: null,
    fitOutPeriod: null,
    deposit: null,
    leaseTerm: null,
    indexation: null,
    openingDate: null,
    leaseStart: null,
    leaseExpiry: null
  },

  salesTerms: {
    askingPrice: null,
    pricePerM2: null,
    currentOffer: null,
    agreedPrice: null,
    paymentSchedule: null,
    deposit: null,
    plannedClosingDate: null
  },

  responsibility: {
    responsibleManagerId: null,
    supportingManagerId: null,
    referralPartnerId: null
  },

  operational: {
    nextAction: null,
    nextActionDate: null,
    lastActivityDate: null,
    notes: []
  },

  dealIds: [],
  documentIds: [],
  activityIds: [],
  commentIds: [],
  statusHistoryIds: [],

  visibility: "Internal",
  createdAt: null,
  updatedAt: null
}
```

---

# 12. Unit statuses

Keep unit commercial status separate from deal stage.

Initial statuses:

- Vacant
- Available
- Active Marketing
- Lead
- Viewing
- Negotiation
- LOI
- Contract Draft
- Contract Signed
- Occupied
- For Sale
- Sale Negotiation
- Sold
- Temporarily Blocked
- Not Available
- Unknown

Statuses must be editable in Settings.

Status colors must be configurable and must not be hard-coded inside rendering logic.

---

# 13. Interactive floor-plan requirements

The floor plan is a critical acceptance feature.

The user must be able to:

1. select a project;
2. select a building/block;
3. select a floor;
4. see the floor plan;
5. see clickable units;
6. switch visualization modes;
7. click a unit;
8. open the unit drawer;
9. change status;
10. assign a brand;
11. open or create a deal;
12. add a comment;
13. create a task;
14. register a document;
15. see all updates immediately.

Use SVG polygons or another reliable browser-supported method.

At least one sample floor plan must contain true clickable polygons.

---

# 14. Floor-plan visualization modes

Provide separate modes with separate legends.

## 14.1 Leasing / Sales status

Display units by commercial status:

- available;
- active marketing;
- in process;
- negotiation;
- signed/leased;
- sold;
- blocked.

## 14.2 Merchandise mix

Display units by:

- category;
- subcategory.

Example categories:

- Fashion
- F&B
- Services
- Entertainment
- Grocery
- Beauty
- Electronics
- Office
- Other

## 14.3 Target versus actual

Show:

- target category;
- actual category;
- category gaps;
- deviations.

## 14.4 Manager view

Optionally color by responsible manager.

## 14.5 Availability view

Show:

- available;
- in process;
- occupied/sold;
- unavailable.

Do not mix unrelated meanings in one color system.

Every map mode must include:

- legend;
- text labels;
- tooltips;
- accessible non-color indicators where practical.

---

# 15. Unit drawer

Clicking a unit opens a side drawer without leaving the floor plan.

Show:

## Summary

- unit number;
- floor;
- area;
- status;
- target category;
- actual category;
- tenant/brand;
- responsible manager.

## Commercial

- asking rent or sale price;
- agreed terms;
- commercial notes.

## Deal

- active deals;
- current stage;
- probability if used;
- next action;
- next action date;
- last activity.

## Contacts

- brand contacts;
- decision makers;
- broker/referral contacts.

## Documents

- LOI;
- proposal;
- contract;
- plans;
- correspondence;
- other files.

## Activity timeline

- calls;
- meetings;
- viewings;
- emails/manual notes;
- status changes;
- comments;
- document uploads;
- tasks.

## Actions

- change status;
- assign brand;
- create deal;
- add prospect;
- add task;
- add comment;
- register file;
- open CRM record;
- compare with merchandise plan.

Actions must work in the prototype where feasible.

---

# 16. Floor-plan import and mapping wizard

The future product may support:

- PDF;
- SVG;
- PNG;
- JPG;
- CAD/DWG;
- BIM/IFC.

Future vision:

```text
Upload floor plan
-> detect units
-> read labels
-> read areas
-> create polygons
-> connect units
-> request human verification
```

Do not fake this functionality in the MVP.

Build a Plan Import / Mapping Wizard:

1. choose or upload a sample plan;
2. identify project, building, and floor;
3. display the plan;
4. load supplied SVG/JSON polygons;
5. map polygons to unit IDs;
6. allow manual correction;
7. save mapping locally;
8. make units clickable.

If vector text extraction is feasible, it may suggest unit matches.

For raster files, use manual mapping unless reliable local OCR/CV exists.

Label any recognition feature as experimental.

---

# 17. Merchandise mix

Keep these separate:

- Target Merchandise Mix
- Actual Merchandise Mix

For projects, floors, and units support:

- category;
- subcategory;
- target share;
- actual share;
- target GLA;
- actual GLA;
- target units;
- actual units.

Analytics:

- target vs actual by GLA;
- target vs actual by unit count;
- category gaps;
- overrepresented categories;
- underrepresented categories;
- vacant area by category;
- pipeline area by category.

Allow switching between:

- unit count;
- GLA.

Categories and subcategories must be editable.

---

# 18. Brand database

The brand database is a long-term proprietary company asset.

Each brand should support:

```javascript
{
  id: "BRAND-001",
  name: "Demo Brand",
  legalName: null,
  logoUrl: null,
  website: null,
  countryOfOrigin: null,
  operatingCountries: [],
  status: "Active",

  classification: {
    category: null,
    subcategory: null,
    priceSegment: null,
    format: null,
    brandType: null
  },

  companyId: null,
  contactIds: [],

  expansionRequirements: {
    targetCities: [],
    targetProjects: [],
    preferredLocationType: null,
    minimumAreaM2: null,
    preferredAreaM2: null,
    maximumAreaM2: null,
    frontageRequirement: null,
    floorPreference: null,
    parkingRequirements: null,
    accessRequirements: null,
    targetRentRange: null,
    commercialModel: null,
    openingTimeline: null,
    fitOutRequirements: null
  },

  relationship: {
    ownerId: null,
    source: null,
    lastContactDate: null,
    nextFollowUpDate: null,
    relationshipStatus: null
  },

  history: {
    projectIds: [],
    unitIds: [],
    dealIds: [],
    rejectedProjectIds: [],
    rejectionReasons: []
  },

  notes: {
    general: [],
    internal: []
  },

  documentIds: [],
  activityIds: [],
  visibility: "Internal"
}
```

Support multiple contacts per brand.

Contact fields:

- name;
- position;
- phone;
- email;
- Telegram/WhatsApp where appropriate;
- city/country;
- preferred language;
- notes.

Phone formatting should be consistent.

---

# 19. Company database

Separate companies from brands.

One company may own multiple brands.

Company fields:

- company ID;
- legal name;
- trading name;
- country;
- website;
- industry;
- company type;
- brand IDs;
- contact IDs;
- responsible manager;
- notes;
- documents;
- activity history.

Do not create duplicate company records for every brand.

---

# 20. Contact database

Create a central contact database.

Fields:

- contact ID;
- first name;
- last name;
- position;
- company;
- brands;
- phones;
- emails;
- messaging apps;
- city;
- country;
- preferred language;
- relationship owner;
- last contact;
- next action;
- notes.

One contact may be linked to:

- multiple brands;
- one company;
- multiple deals;
- multiple projects.

---

# 21. Requirement model

A brand or buyer may have a general requirement before a specific opportunity exists.

Separate:

```text
Contact
Company
Brand
Requirement
Lead
Opportunity / Deal
Unit
```

Recommended flow:

```text
Brand / Client
  -> Requirement
    -> Opportunity
      -> Unit(s)
        -> Negotiation
          -> Contract
            -> Commission
```

---

# 22. Leasing pipeline

Stages must be configurable.

Initial stages:

1. Lead
2. Contacted
3. Qualified
4. Requirement Confirmed
5. Property / Unit Offered
6. Viewing Scheduled
7. Viewing Completed
8. Negotiation
9. LOI / Commercial Terms
10. Contract Draft
11. Contract Signed
12. Tenant Handover / Opening Preparation
13. Commission Pending
14. Commission Received
15. Closed Won
16. Closed Lost

Closed Lost should require a reason.

Possible reasons:

- rent too high;
- wrong location;
- area too large;
- area too small;
- project timing;
- competitor selected;
- internal brand decision;
- no response;
- terms rejected;
- other.

The system must not treat a deal as financially complete until required commission/payment conditions are satisfied, unless configured otherwise.

---

# 23. Sales pipeline

Use a separate sales pipeline.

Stages:

1. Lead
2. Contacted
3. Qualified Buyer
4. Requirement Confirmed
5. Property / Unit Offered
6. Viewing
7. Offer
8. Negotiation
9. Reservation / Deposit
10. Contract
11. Payment In Progress
12. Payment Completed
13. Commission Pending
14. Commission Received
15. Closed Won
16. Closed Lost

Do not force leasing-only fields into sales deals.

A project or unit can be configured as:

- leasing only;
- sales only;
- leasing and sales.

---

# 24. Deal schema

```javascript
{
  id: "DEAL-001",
  type: "Leasing",
  projectId: "PROJ-001",
  unitIds: [],
  brandId: null,
  companyId: null,
  contactIds: [],

  ownership: {
    responsibleManagerId: null,
    supportManagerId: null,
    referralPartnerId: null
  },

  stage: "Lead",
  probability: null,
  dateEnteredStage: null,
  status: "Open",

  commercialTerms: {
    askingRent: null,
    proposedRent: null,
    agreedRent: null,
    serviceCharge: null,
    turnoverRent: null,
    deposit: null,
    rentFreePeriod: null,
    fitOutPeriod: null,
    leaseTerm: null,
    indexation: null,

    askingPrice: null,
    offerPrice: null,
    agreedPrice: null,
    paymentSchedule: null,
    plannedClosingDate: null
  },

  nextAction: {
    text: null,
    ownerId: null,
    dueDate: null
  },

  activity: {
    lastContactDate: null,
    activityIds: []
  },

  documentIds: [],

  outcome: {
    won: false,
    lost: false,
    lostReason: null,
    signedDate: null,
    paymentDate: null,
    commissionStatus: "Not Applicable"
  },

  visibility: "Internal",
  createdAt: null,
  updatedAt: null
}
```

---

# 25. Pipeline views

Provide three views of the same deal data.

## Kanban

Deals by stage.

Drag/drop may be implemented if it is reliable and records history.

## Table

Sortable and filterable deal table.

## Project/floor-plan view

Deals visible through linked unit polygons.

Never create separate duplicate data stores for different views.

---

# 26. CRM filters

Support:

- project;
- building;
- floor;
- unit;
- deal type;
- stage;
- unit status;
- responsible manager;
- brand;
- company;
- category;
- subcategory;
- area range;
- rent range;
- sale price range;
- next action date;
- overdue;
- source;
- client;
- lost reason;
- signed/unsigned;
- commission received/pending.

Provide:

- active filter chips;
- individual remove buttons;
- Reset All.

---

# 27. Tasks and daily work

Every important record should support tasks.

Task schema:

```javascript
{
  id: "TASK-001",
  title: "Follow up with brand",
  projectId: null,
  unitId: null,
  brandId: null,
  dealId: null,
  assigneeId: null,
  dueDate: null,
  priority: "Normal",
  status: "Open",
  comment: null,
  createdAt: null,
  completedAt: null
}
```

Dashboard views:

- overdue;
- due today;
- next seven days;
- no next action;
- inactive deals;
- client comments awaiting response.

Provide one-click completion and rescheduling.

---

# 28. Activities and timelines

Maintain activity histories for:

- brands;
- companies;
- contacts;
- projects;
- units;
- deals.

Activity types:

- call;
- meeting;
- viewing;
- email note;
- WhatsApp/Telegram note;
- proposal sent;
- document uploaded;
- stage change;
- status change;
- client comment;
- internal comment;
- task completed;
- client decision.

In the MVP, activities may be manually created.

---

# 29. Notes and comments

Separate:

## Internal notes

Visible only to authorized internal users.

## Client-visible notes

May appear in the client portal.

## Client comments

Created by owners/clients.

Each comment must include:

- author;
- timestamp;
- related object;
- visibility;
- response status.

Statuses:

- Open;
- In Review;
- Resolved.

---

# 30. Documents and file registry

Document types:

- floor plan;
- brochure;
- presentation;
- commercial terms;
- owner instruction;
- tenant proposal;
- LOI;
- contract;
- invoice;
- report;
- photo;
- technical document;
- other.

Document schema:

```javascript
{
  id: "DOC-001",
  fileName: "Demo brochure.pdf",
  category: "Brochure",
  projectId: null,
  unitId: null,
  brandId: null,
  dealId: null,
  version: 1,
  uploadedBy: null,
  uploadedAt: null,
  visibility: "Internal",
  fileSize: null,
  localUrl: null,
  comment: null
}
```

Visibility:

- Internal;
- Client-visible;
- Restricted.

Do not claim production secure storage.

---

# 31. Roles and permissions

Create a prototype role system with actual UI differences.

## Founder / Curator / Super Admin

Can:

- access all projects;
- access all CRM records;
- see internal notes;
- see financial and commission information;
- manage settings;
- preview the client portal;
- access all reports;
- manage prototype users.

## Head of Leasing & Sales

Can:

- manage projects;
- manage teams;
- manage pipelines;
- assign managers;
- see reports;
- manage brands;
- manage owner reporting;
- see permitted commissions.

## Leasing / Sales Manager

Can:

- manage assigned properties;
- manage assigned units;
- manage leads;
- manage brands;
- create activities;
- update deal stages;
- add notes;
- register documents;
- create tasks;
- update next actions.

## Leasing Administrator / CRM Coordinator

Can:

- maintain CRM;
- maintain project data;
- maintain unit data;
- maintain documents;
- prepare reports;
- check completeness;
- manage activities.

## External Agent / Referral Partner

Future limited role.

May access only selected:

- availability;
- assigned leads;
- assigned project information.

## Client / Property Owner

Can access only assigned projects.

Can:

- view dashboard;
- view approved floor plans;
- see approved statuses;
- see approved progress;
- see approved merchandise mix;
- download approved reports;
- download approved files;
- leave comments;
- review updates.

Cannot see:

- internal notes;
- commissions;
- sensitive negotiation comments;
- other clients;
- other projects;
- restricted brand data.

Future roles:

- Asset Manager;
- Facility Manager;
- Technical Manager;
- Property Manager;
- Finance;
- Owner Representative;
- Tenant Portal User;
- Field Inspector.

---

# 32. Login and session prototype

Create a demo login screen.

Requirements:

- Enter key submits;
- multiple demo users;
- role badge;
- local session persistence;
- logout;
- role-based UI;
- prototype-authentication warning.

Demo users should include:

- founder/admin;
- head of leasing;
- leasing manager;
- administrator;
- at least two client users.

Do not use real passwords or claim production security.

---

# 33. Internal dashboard

The dashboard should answer:

```text
What needs attention today?
```

## Portfolio KPIs

- active projects;
- total leasing GLA;
- total sales GLA;
- leased GLA;
- vacant GLA;
- GLA in negotiation;
- signed deals;
- sales pipeline value;
- overdue follow-ups;
- deals without next action;
- stale deals;
- missing documents;
- client comments awaiting response.

## Today's work

- overdue tasks;
- tasks due today;
- upcoming meetings;
- follow-ups;
- contracts requiring action;
- owners requiring updates;
- brands requiring response.

## Pipeline snapshot

Leasing and sales pipeline by stage.

## Data hygiene

Show:

- records without a responsible manager;
- deals without next action;
- stale activities;
- inconsistent unit status;
- missing floor plans;
- duplicate contacts/brands;
- missing category;
- missing area;
- missing commercial terms.

---

# 34. Dashboard calculation rules

KPIs must be calculated from unit and deal data.

Do not hard-code KPI values.

Examples:

## Leased GLA

Sum unit GLA only for units whose approved current status qualifies as leased.

## Vacant GLA

Sum unit GLA for currently available or vacant units.

## Pipeline GLA

Use explicitly defined deal/unit rules.

Avoid double-counting the same unit when several prospects exist.

Inventory and pipeline must be visibly distinguished.

---

# 35. Client portal

The client portal must be simpler than the internal application.

The client should feel:

```text
I can see what is happening with my property without asking for Excel updates every day.
```

Client access must be limited by:

- client ID;
- assigned projects;
- object visibility;
- field visibility;
- approved document visibility.

## Client dashboard

Show approved metrics:

- total GLA;
- leased GLA;
- vacant GLA;
- GLA under negotiation;
- leased percentage;
- available percentage;
- signed deals;
- active negotiations;
- sales progress;
- recent changes;
- merchandise mix;
- pipeline summary;
- next key actions;
- last update date.

## Client floor plan

Client can:

- select floor;
- see approved floor plan;
- see approved status colors;
- click unit;
- see approved information;
- leave comments.

Internal and client unit drawers must be different.

---

# 36. Client status mapping

Internal statuses can be mapped to simplified client statuses.

Example:

| Internal status | Client status |
|---|---|
| Lead | Interest |
| Contacted | Interest |
| Qualified | Interest |
| Viewing | Interest |
| Negotiation | In Negotiation |
| LOI | In Negotiation |
| Contract Draft | Contracting |
| Contract Signed | Leased |
| Available | Available |
| Sold | Sold |

This mapping must be configurable.

---

# 37. Reporting

Create a report generator.

Reports must be calculated from current application data.

## Client report

Include:

- executive summary;
- leasing and sales progress;
- leased, vacant, and negotiating area;
- changes since previous report;
- floor/unit status;
- merchandise mix;
- client-approved key deals;
- decisions required;
- next steps;
- last updated timestamp.

Exclude:

- internal commissions;
- internal staff notes;
- confidential negotiations;
- restricted contacts.

## Internal reports

Include:

### Leasing

- GLA by status;
- pipeline by stage;
- pipeline by manager;
- conversion;
- stage aging;
- signed deals;
- pending commissions;
- received commissions;
- lost reasons;
- brands by category.

### Sales

- available units/value;
- pipeline value;
- offers;
- negotiations;
- contracts;
- payments;
- commission status.

### Activity

- overdue follow-ups;
- activities by manager;
- deals without next action;
- stale deals.

### Data quality

- units without area;
- units without category;
- brands without contacts;
- duplicate contacts;
- outdated commercial terms.

Support:

```text
Print -> Save as PDF
```

Add a print stylesheet.

---

# 38. Commission tracking

Create a configurable internal commission model.

```javascript
{
  grossCommission: null,
  invoiceDate: null,
  expectedPaymentDate: null,
  receivedAmount: null,
  receivedDate: null,
  status: "Pending",
  companyShare: null,
  managerShare: null,
  externalAgentShare: null,
  administratorShare: null,
  notes: null
}
```

Commission rules must be configurable in Settings.

Client users must never see commission distribution.

---

# 39. Brand-to-unit matching

Create deterministic matching for the MVP.

A brand has requirements. A unit has characteristics.

Match using:

- category;
- subcategory;
- area;
- floor;
- frontage;
- project location;
- target merchandise mix;
- rent budget;
- city;
- format;
- accessibility.

Provide:

- Suggested Brands for Unit;
- Suggested Units for Brand.

Explain matching criteria.

Never present suggestions as guaranteed recommendations.

---

# 40. Data completeness

Show completeness indicators.

## Brand completeness

- category;
- contacts;
- expansion requirements;
- last contact;
- owner.

## Unit completeness

- area;
- status;
- category;
- commercial terms;
- polygon mapping.

## Deal completeness

- responsible manager;
- contact;
- stage;
- next action;
- linked unit/project;
- commercial terms.

---

# 41. Stale data and stale deals

Create configurable stale rules.

Examples:

- no deal activity for X days;
- no contact with a brand for X days;
- unit terms not updated for X days;
- mandate expiry approaching;
- no next action;
- client comment awaiting response.

Thresholds belong in Settings.

---

# 42. Import and export

Support:

- JSON export;
- JSON import;
- CSV export for major tables;
- CSV import where practical.

Data areas:

- projects;
- buildings;
- floors;
- units;
- brands;
- companies;
- contacts;
- requirements;
- deals;
- tasks;
- activities;
- comments;
- documents.

Validate imports before replacement.

Invalid imports must not corrupt the application.

Provide:

- preview;
- validation messages;
- confirm import;
- cancel.

---

# 43. Search

Global search must support:

- project;
- building;
- floor;
- unit;
- brand;
- company;
- contact;
- deal;
- task;
- document.

Results must display object type and context.

Examples:

```text
Nike — Brand
Unit F1-023 — Unit — Project X
John Smith — Contact — Company Y
```

---

# 44. Configuration and settings

Create editable configuration for:

- deal stages;
- unit statuses;
- status colors;
- merchandise categories;
- subcategories;
- lost reasons;
- commission rules;
- user roles;
- client status mappings;
- report visibility;
- stale-deal thresholds;
- currencies;
- units;
- document visibility;
- notification rules.

Avoid hard-coding business rules deep in rendering code.

---

# 45. Notifications

Prototype notifications may show:

- overdue tasks;
- client comments;
- stale deals;
- contract expiry;
- missing next action;
- new assignments;
- report due;
- mandate expiry.

Use local data only.

---

# 46. Auto-save and local persistence

Use:

- `localStorage` for structured data;
- IndexedDB only if necessary for larger files;
- reset to demo data;
- export backup;
- corrupted-data recovery.

Forms should show:

- Saving;
- Saved;
- Unsaved changes.

Avoid silent data loss.

---

# 47. Demo dataset

Create realistic demo data clearly labeled as demo/test data.

Include at least:

- 2 projects;
- multiple buildings or floors;
- 30–50 units;
- multiple merchandise categories;
- 20–30 brands;
- several companies;
- multiple contacts;
- leasing deals at different stages;
- sales deals;
- multiple prospects on one unit;
- one multi-unit deal;
- tasks;
- activities;
- comments;
- client-visible and internal documents;
- at least 2 client users;
- multiple internal users;
- one or more sample SVG floor plans.

Demo records must include:

```javascript
demoRecord: true
```

Do not present demo data as real company or client data.

---

# 48. Responsive and visual design

The application is an operating system, not a marketing website.

Visual direction:

- professional;
- premium;
- clean;
- modern;
- data-driven;
- spatial;
- efficient;
- dense enough for daily work;
- not cluttered.

Use:

- compact tables;
- clear badges;
- side drawers;
- professional charts;
- restrained color;
- clear hierarchy;
- strong typography;
- subtle motion.

Avoid:

- excessive gradients;
- gaming UI;
- excessive glassmorphism;
- decorative animations;
- marketing-style cards;
- excessive whitespace that harms productivity.

Support:

- 1920×1080;
- 1440×900;
- 1366×768;
- 1024×768;
- tablet;
- common mobile widths.

Mobile should support quick lookup, comments, tasks, and deal updates. Do not force the full floor-plan desktop experience onto a small phone.

Support light/dark mode only if color-coded floor plans remain readable.

---

# 49. Future Geoanalytics integration

Use shared stable IDs.

Shared entities:

- Property/Building ID;
- Project ID;
- Brand ID;
- Company ID;
- coordinates;
- address;
- asset type.

Future flows:

## Geoanalytics to Leasing & Sales

A user finds a property and opens permitted:

- availability;
- unit status;
- project data;
- leasing information.

## Leasing & Sales to Geoanalytics

Approved data may update:

- property status;
- tenant/brand presence;
- verified building data;
- availability indicators;
- market data.

Do not publish confidential leasing data automatically.

Use data classification and permissions.

Unified identifier concept:

```text
Property ID
Building ID
Floor ID
Unit ID
```

Example format:

```text
PROP-UZ-TAS-000123
```

The final format can change, but IDs must remain stable.

---

# 50. Future Building OS, Asset Management, and FM

The interactive floor plan should evolve into a reusable spatial entity layer.

Future Building OS data may include:

- lease administration;
- rent collection;
- arrears;
- turnover;
- OPEX;
- NOI;
- maintenance;
- work orders;
- equipment;
- technical systems;
- incidents;
- CAPEX;
- inspection history;
- energy;
- vendors;
- documents.

Future Asset Management may include:

- business plan;
- rent roll;
- budget;
- forecast;
- plan vs actual;
- NOI;
- occupancy;
- lease expiry;
- renewals;
- arrears;
- tenant performance;
- CAPEX;
- owner reporting.

Future Facility Management may include:

- cleaning;
- maintenance;
- preventive maintenance;
- helpdesk;
- work orders;
- engineering;
- vendors;
- SLAs;
- inspections;
- incidents;
- assets;
- operating budgets.

Do not implement these now.

---

# 51. AI-ready architecture

Do not build a production AI backend in the HTML MVP.

However, structure business logic as reusable functions.

Future AI requests may include:

- “Show all deals without follow-up for 7 days.”
- “Which units have no active prospects?”
- “Prepare this week’s owner report.”
- “Which brands fit Unit 204?”
- “Show all F&B brands interested in Tashkent.”
- “Which deals are stuck in negotiation?”
- “Show units leased but missing signed contracts.”
- “Summarize what changed in Project X this week.”
- “Which merchandise categories are below target?”
- “Create a follow-up list for Nodir.”

Client AI must only use approved client data.

---

# 52. AI tool registry

Create provider-independent structured functions:

```javascript
searchBrands()
searchCompanies()
searchContacts()
searchProjects()
searchUnits()
filterUnits()
getProject()
getFloor()
getUnit()
getDeal()
getDealsByStage()
getDealsWithoutNextAction()
getOverdueTasks()
calculateLeasedGLA()
calculateVacantGLA()
calculatePipelineGLA()
calculatePipelineValue()
aggregateMerchandiseMix()
suggestBrandsForUnit()
suggestUnitsForBrand()
generateOwnerReport()
getProjectChanges()
createTask()
addComment()
getDataCompleteness()
getVisibleDocuments()
```

The future AI should call tools, not simulate mouse clicks.

---

# 53. Recommended AI architecture

```text
User request
    |
    v
AI interface
    |
    v
Intent parser / planner
    |
    v
Permission checker
    |
    v
Structured tool registry
    |
    v
Application services
    |
    v
Leasing & Sales data platform
```

AI must distinguish:

- platform data;
- calculated results;
- external research;
- assumptions;
- unavailable information.

Permanent edits require confirmation.

---

# 54. Audit log concept

Future production architecture must record:

- user;
- timestamp;
- action;
- prompt;
- tools used;
- datasets accessed;
- fields changed;
- reports generated;
- exports produced;
- client-visible actions;
- permanent changes.

For the MVP, record important changes in a local audit log.

---

# 55. Security and privacy

Do not commit or expose:

- API keys;
- passwords;
- tokens;
- confidential client data;
- private credentials.

Do not claim static HTML provides security.

Future production architecture must support:

- role-based access;
- client segregation;
- private fields;
- audit logs;
- secure file storage;
- server-side authorization;
- session management;
- encryption where appropriate;
- backups;
- secure APIs.

AI must never access raw unrestricted database data.

---

# 56. Recommended Claude Code skills and GitHub sources

The project should use project-specific skills under:

```text
.claude/skills/
```

Create or adapt these skills:

```text
leasing-product-architect
cre-operations-analyst
crm-data-modeler
property-and-unit-data-engineer
interactive-floorplan-engineer
merchandise-mix-analyst
leasing-pipeline-analyst
sales-pipeline-analyst
commercial-real-estate-financial-analyst
brand-and-market-researcher
data-quality-and-provenance
client-portal-permissions
reporting-and-dashboard-analyst
document-and-file-registry
local-storage-and-import-export
geoanalytics-integration-architect
building-os-architecture
ai-tool-designer
ai-safety-and-permissions
frontend-ux-engineer
testing-and-qa
```

Each skill must include:

- purpose;
- responsibilities;
- inputs;
- outputs;
- constraints;
- validation checklist;
- prohibited behavior;
- examples.

## Official and general Claude skill sources

### Anthropic Skills

https://github.com/anthropics/skills

Use for:
- Claude skill structure;
- reusable instructions;
- official examples.

### Everything Claude Code

https://github.com/affaan-m/everything-claude-code

Use for:
- project configuration;
- subagents;
- hooks;
- commands;
- testing workflows.

### Alirezarezvani Claude Skills

https://github.com/alirezarezvani/claude-skills

Use for:
- financial analysis;
- business analysis;
- market research;
- product management;
- QA;
- security.

### Awesome Agent Skills

https://github.com/VoltAgent/awesome-agent-skills

Use for discovering reusable agent skill patterns.

### Agent Skill Exchange

https://github.com/agentskillexchange/skills

Use for discovering third-party skills.

### Claude AI Skills Collection

https://github.com/obviousworks/Claude-AI-skills-collection-2026

Use for skill discovery and agent workflow examples.

### Reusable Claude Code configuration

https://github.com/Imran-ml/claude-skills

Use for `.claude` configuration, skills, subagents, hooks, and workflows.

---

# 57. Frontend, floor-plan, and data technology references

### Leaflet

https://github.com/Leaflet/Leaflet

Use only if geographic maps are needed in the MVP.

### MapLibre GL JS

https://github.com/maplibre/maplibre-gl-js

Use for future Geoanalytics integration.

### SVG

Use native browser SVG for interactive floor plans where practical.

### Chart.js

https://github.com/chartjs/Chart.js

Use for lightweight charts if required.

### PostgreSQL

https://github.com/postgres/postgres

Future relational database.

### Supabase

https://github.com/supabase/supabase

Potential future backend platform.

### PostgREST

https://github.com/PostgREST/postgrest

Potential future API layer.

### PostGIS

https://github.com/postgis/postgis

Future geospatial database extension.

### pgvector

https://github.com/pgvector/pgvector

Future document and semantic-search capability.

---

# 58. AI and integration references

### Model Context Protocol specification

https://github.com/modelcontextprotocol/specification

### MCP reference servers

https://github.com/modelcontextprotocol/servers

### LangChain

https://github.com/langchain-ai/langchain

### LlamaIndex

https://github.com/run-llama/llama_index

### PydanticAI

https://github.com/pydantic/pydantic-ai

### LiteLLM

https://github.com/BerriAI/litellm

### Microsoft AutoGen

https://github.com/microsoft/autogen

### OpenAI Agents SDK

https://github.com/openai/openai-agents-python

### Example AI agent applications

https://github.com/gayu2k01/agent-ai

Use these as architecture references. Do not add an AI framework to the MVP without a clear requirement.

---

# 59. Commercial real estate and financial references

### CRE Skills Plugin

https://github.com/mariourquia/cre-skills-plugin

Potential use:
- leasing;
- underwriting;
- asset management;
- capital markets;
- development;
- CRE workflows.

### CRE AI Skills

https://github.com/cre-ai-skills/CRE-AI-Skills

Potential use:
- due diligence;
- underwriting;
- financing;
- lease review;
- market research.

### AI Real Estate Analyst

https://github.com/zubair-trabzada/ai-realestate-claude

Potential use:
- property research;
- comparable analysis;
- cash-flow scenarios;
- screening;
- reporting.

### Commercial real estate topic

https://github.com/topics/commercial-real-estate

Use for additional repository discovery.

All financial and CRE skills must be reviewed for:

- assumptions;
- formulas;
- local-market suitability;
- missing-data behavior;
- source quality;
- commercial-use license.

---

# 60. Safe repository adoption rules

Do not blindly install repositories.

Before adopting a repository, inspect:

- README;
- license;
- recent activity;
- dependencies;
- shell scripts;
- install scripts;
- hooks;
- post-install commands;
- filesystem access;
- network access;
- environment-variable access;
- API-key requirements;
- prompt-injection risk;
- data collection;
- commercial-use restrictions.

Use this priority:

## Priority 1

Project-specific skills in:

```text
.claude/skills/
```

## Priority 2

Official sources:

- https://github.com/anthropics/skills
- https://github.com/modelcontextprotocol/specification
- https://github.com/modelcontextprotocol/servers
- https://github.com/postgres/postgres
- https://github.com/postgis/postgis

## Priority 3

Specialized libraries and architectural references.

## Priority 4

Third-party domain skill collections.

Copy only reviewed skill files. Do not execute unknown installers automatically.

---

# 61. Required repository audit table

Create:

| Repository | Type | Intended use | License reviewed | Security reviewed | Adopted files | Status |
|---|---|---|---|---|---|---|
| Example | Skill / library / framework | Description | Yes/No | Yes/No | Path | Approved/Rejected |

---

# 62. Technical implementation preferences

Prefer:

- one main HTML file or a small clean file structure;
- embedded or clearly separated CSS and JavaScript;
- no build process if possible;
- SVG for floor plans;
- localStorage for structured data;
- IndexedDB only when required;
- minimal dependencies;
- central application state;
- stable IDs;
- configuration-driven statuses;
- reusable rendering functions;
- explicit visibility rules;
- print stylesheet.

The application must open directly in a browser or have simple documented startup instructions.

---

# 63. Required screens

Implement working versions of:

1. Login
2. Internal Home Dashboard
3. Projects List
4. Project Dashboard
5. Interactive Floor Plan
6. Units Table
7. Leasing Pipeline
8. Sales Pipeline
9. Deal Detail
10. Brand Database
11. Brand Detail
12. Companies
13. Contacts
14. Requirements
15. Tasks
16. Activities
17. Reports
18. Documents
19. Client Portal Dashboard
20. Client Floor Plan
21. Settings
22. Import / Export

Do not create empty navigation destinations. If a screen is not implemented, mark it clearly as future and do not present it as complete.

---

# 64. Required user flows

## Flow 1 — Internal login

1. Open login.
2. Enter demo credentials.
3. Press Enter.
4. Enter application.
5. Confirm role-specific permissions.

## Flow 2 — Open project

1. Select project.
2. Open project dashboard.
3. View KPIs.
4. Open floor plan.
5. Select floor.

## Flow 3 — Unit management

1. Click unit.
2. Open unit drawer.
3. Change status.
4. Assign brand.
5. Add note.
6. Add task.
7. Save.
8. Confirm plan color updates.
9. Confirm dashboard updates.

## Flow 4 — Merchandise mix

1. Open floor plan.
2. Switch to Merchandise Mix.
3. Confirm category colors.
4. Switch to Target vs Actual.
5. Confirm differences.

## Flow 5 — Brand CRM

1. Search brand.
2. Open brand profile.
3. Review contacts.
4. Review requirements.
5. Create opportunity.
6. Link project/unit.
7. Create follow-up.

## Flow 6 — Leasing deal

1. Create deal.
2. Link brand.
3. Link unit.
4. Assign manager.
5. Move through pipeline.
6. Add commercial terms.
7. Add activity.
8. Register document.
9. Mark contract signed.
10. Mark commission pending.
11. Record commission received.

## Flow 7 — Multiple prospects

1. Open a unit.
2. Link multiple prospects.
3. See all prospects.
4. Confirm unit area is counted once in inventory KPIs.

## Flow 8 — Multi-unit deal

1. Create deal.
2. Link multiple units.
3. Confirm deal area calculation.

## Flow 9 — Client login

1. Logout internal user.
2. Login as client.
3. Confirm only assigned projects are visible.
4. Open client dashboard.
5. Open floor plan.
6. Click unit.
7. Leave comment.
8. Print/download report.
9. Open approved file.

## Flow 10 — Client comment

1. Client leaves comment.
2. Internal user logs in.
3. Comment appears in notifications.
4. Internal user responds.
5. Comment is resolved.

## Flow 11 — Reporting

1. Generate client report.
2. Confirm current data appears.
3. Confirm internal data is excluded.
4. Confirm print/PDF view.

## Flow 12 — Persistence

1. Make changes.
2. Refresh browser.
3. Confirm changes persist.
4. Export JSON.
5. Reset demo data.
6. Import JSON.
7. Confirm data is restored.

---

# 65. Final QA and check-up task

Before declaring the MVP complete, run this complete check-up.

## Application checks

- no blocking JavaScript errors;
- no blank screens;
- no fake buttons;
- no broken navigation;
- no overlapping panels;
- no lost state;
- no duplicated event handlers;
- no invalid links;
- no clipped critical content.

## Login and roles

- Enter key submits login;
- logout works;
- internal roles display correctly;
- client role displays correctly;
- role-based views differ;
- client cannot see internal notes;
- client cannot see commissions;
- client cannot see other clients or projects;
- prototype authentication warning is visible.

## Projects and units

- projects can be created/edited where allowed;
- buildings and floors are linked correctly;
- unit IDs are unique;
- unit areas validate;
- unit statuses update;
- status history is created;
- project totals update;
- unit data persists.

## Floor plans

- sample floor plan loads;
- units are clickable;
- selected unit is correct;
- hover state works;
- status view works;
- merchandise mix view works;
- Target vs Actual view works;
- legends are correct;
- floor switching works;
- zoom/pan works if implemented;
- status changes update colors;
- plan and table show the same state;
- no duplicate click handlers exist.

## CRM

- brands can be searched;
- brands can be created/edited;
- companies are separate from brands;
- contacts support multiple brand links;
- duplicate warnings work;
- requirements can be created;
- opportunities can be created;
- deals can be linked to multiple units;
- multiple prospects can link to one unit;
- next actions work;
- activities appear in timelines.

## Pipelines

- leasing pipeline works;
- sales pipeline works;
- Kanban updates table;
- table updates unit/floor-plan views;
- stages are configurable;
- lost reasons are required where appropriate;
- stage history is recorded;
- pipeline filters work.

## Calculations

- total GLA is correct;
- leased GLA is correct;
- vacant GLA is correct;
- pipeline GLA is correct;
- pipeline value is correct;
- target/actual merchandise calculations are correct;
- multi-unit deal area is correct;
- multiple prospects do not duplicate inventory GLA;
- client KPIs use approved visibility rules;
- missing values do not become zero;
- denominators are visible where relevant.

## Tasks and activities

- tasks can be created;
- tasks can be assigned;
- due dates work;
- overdue status works;
- completion works;
- rescheduling works;
- dashboard updates;
- activities appear in timelines.

## Documents

- demo files display;
- document metadata is stored;
- visibility is respected;
- client-visible documents appear in portal;
- internal documents do not appear in portal;
- document registration works.

## Client portal

- client sees only assigned projects;
- dashboard is simplified;
- floor plan is accessible;
- approved unit data appears;
- comments can be created;
- comments appear internally;
- reports exclude restricted information;
- client downloads approved documents only.

## Reports

- internal report works;
- client report works;
- reports reflect current data;
- changes since previous period can be shown;
- internal information is excluded from client reports;
- print stylesheet works;
- no clipping occurs;
- browser Save as PDF works.

## Persistence and import/export

- localStorage persistence works;
- refresh preserves data;
- reset demo data works;
- JSON export works;
- JSON import works;
- CSV export works where implemented;
- invalid imports are rejected safely;
- corrupted local data does not create a blank application;
- backup and restore workflow works.

## Responsive testing

Test at:

- 1920×1080;
- 1440×900;
- 1366×768;
- 1024×768;
- tablet width;
- common mobile width.

Confirm:

- navigation remains usable;
- drawers fit;
- tables do not destroy the layout;
- floor plan remains usable;
- text is not clipped;
- mobile quick actions work.

## Technical review

Confirm:

- no secrets are included;
- no production security claims are made;
- no backend is accidentally required;
- external libraries are documented;
- all major modules are understandable;
- business rules are not unnecessarily duplicated;
- status colors are configurable;
- visibility rules are explicit;
- stable IDs are used;
- future Geoanalytics integration is possible;
- future Building OS integration is possible.

Produce a final QA report containing:

- implemented features;
- partially implemented features;
- simulated features;
- known bugs;
- data limitations;
- security limitations;
- AI limitations;
- recommended next improvements.

---

# 66. Final deliverables

Deliver:

## A. Working HTML prototype

The application itself.

## B. Product summary

What is implemented and how the workflow operates.

## C. Data model documentation

Entities, IDs, relationships, and important fields.

## D. Role matrix

What each role can see and do.

## E. Configuration documentation

Statuses, stages, categories, colors, visibility, and rules.

## F. Known limitations

Clearly separate:

- prototype limitations;
- unavailable features;
- known bugs;
- future functionality.

## G. Future production architecture

Explain migration to:

- frontend;
- backend;
- PostgreSQL;
- PostGIS;
- secure file storage;
- authentication;
- RBAC;
- client segregation;
- APIs;
- Geoanalytics integration;
- AI;
- Asset Management;
- Facility Management;
- Building OS.

## H. QA report

List tested workflows and remaining issues.

---

# 67. Final implementation priorities

If time is limited, prioritize:

1. central data model;
2. role-aware login prototype;
3. projects, buildings, floors, and units;
4. interactive floor plan;
5. unit status updates;
6. leasing and sales pipelines;
7. brands, companies, and contacts;
8. tasks and activities;
9. client portal;
10. calculations and data synchronization;
11. reports;
12. local persistence;
13. import/export;
14. merchandise mix;
15. document registry;
16. AI-ready tool architecture;
17. visual polish.

Never sacrifice data correctness, role separation, or state synchronization for decorative design.

---

# 68. Final product philosophy

Do not build a CRM disconnected from the building.

Do not build a floor plan disconnected from the CRM.

Do not build a client dashboard that requires employees to manually copy information into it.

Build one connected operating model:

```text
Client
  -> Project
    -> Building
      -> Floor
        -> Unit
          -> Brand / Buyer
            -> Deal
              -> Activity
                -> Contract
                  -> Commission / Result
```

The floor plan is the spatial interface.

The CRM is the relationship and deal engine.

The brand database is the long-term commercial intelligence asset.

The client portal is the transparency layer.

The future Geoanalytics platform, Building OS, Asset Management, and Facility Management systems should extend this same data model rather than create disconnected software.

For Version 1, build this extremely well:

```text
Leasing
+ Sales
+ CRM
+ Brand Database
+ Company and Contact Database
+ Project / Building / Unit Database
+ Interactive Floor Plans
+ Merchandise Mix
+ Client Portal
+ Reporting
+ Local Persistence
```

---

# 69. Initial instruction to Claude Code

Use this as the first instruction after placing this file in the project:

```text
You are the lead architect and engineering agent for the Leasing & Sales Operating Platform.

Read:
- leasing_sales_operating_platform_claude_code_master_prompt.md
- all files in .claude/
- all existing project files
- all existing data and documentation

Before writing major code:

1. Restate the MVP in a short product specification.
2. Review the requirements and list contradictions, risks, and scope problems.
3. Define the entity model and relationships.
4. Define the role and visibility matrix.
5. Define unit statuses and leasing/sales stages.
6. Define floor-plan architecture.
7. Define dashboard formulas and anti-double-counting rules.
8. Define the local persistence and import/export model.
9. Define the implementation plan.
10. Define the QA plan.

Do not build a backend, production authentication system, cloud storage, payment system, or production AI backend.

Use one central application state model.

Keep unit inventory, deal pipeline, and contact/CRM data separate but connected.

Never duplicate unit GLA because multiple prospects are connected to one unit.

Never expose internal data in client views.

Never treat unknown values as zero.

Do not create fake buttons or placeholder features that appear complete.

The floor plan must contain real clickable unit polygons.

The final check-up task in this prompt must be completed before declaring the MVP finished.

First produce the architecture and implementation plan. Then wait for approval before writing the main application code.
```