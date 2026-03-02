CREATE TABLE alias (
    id integer NOT NULL,
    profile_id text NOT NULL,
    first_name text,
    last_name text,
    middle_name text,
    PRIMARY KEY (id),
    FOREIGN KEY (client_profile_id) REFERENCES person(profile_id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id)
);

CREATE TABLE alternate_credential (
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    credential_key text,
    hashed_password text,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    admin_email text,
    PRIMARY KEY (id)
);

CREATE TABLE assignment_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    us_state text,
    campaign_code text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    current_position_id uuid,
    PRIMARY KEY (id),
    FOREIGN KEY (current_position_id) REFERENCES assignment_queue_position(id)
);

CREATE TABLE assignment_queue_position (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    is_active boolean,
    assignment_queue_id uuid,
    salesperson_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (assignment_queue_id) REFERENCES assignment_queue(id),
    FOREIGN KEY (salesperson_id) REFERENCES salesperson(id)
);

CREATE TABLE case_notes (
    id integer NOT NULL,
    client_profile_id text,
    case_number text,
    location_code text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    updated_by text,
    notes text,
    PRIMARY KEY (id),
    FOREIGN KEY (client_profile_id) REFERENCES person(profile_id)
);

CREATE TABLE charge_code (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    charge_code text,
    charge_description text,
    charge_severity text,
    charge_code_short text,
    us_state text,
    PRIMARY KEY (id)
);

CREATE TABLE charge_label (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    charge_code text,
    charge_description text,
    charge_severity text,
    charge_code_short text,
    remedy text,
    label text,
    charge_code_id uuid,
    PRIMARY KEY (id),
    FOREIGN KEY (charge_code_id) REFERENCES charge_code(id)
);

CREATE TABLE client_document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id text,
    matter_id uuid,
    document_type text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    name text,
    ext text,
    document_edits_id integer,
    deleted_at timestamp with time zone,
    document_category text,
    client_viewable boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (matter_id) REFERENCES matter(matter_id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id),
    FOREIGN KEY (document_edits_id) REFERENCES document_edits(id)
);

CREATE TABLE client_status (
    id integer NOT NULL,
    status_value text,
    lifecycle_stage text,
    description text,
    state text,
    display_order integer,
    display_label text,
    freshworks_lifecycle_stage text,
    PRIMARY KEY (id)
);

CREATE TABLE clio_client_document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_profile_id text,
    clio_client_id text,
    clio_doc_id text NOT NULL,
    clio_matter_id text,
    content_type text NOT NULL,
    created_at date,
    creator_first_name text,
    creator_id text,
    creator_last_name text,
    deleted_at timestamp without time zone,
    document_category_id text,
    document_category_name text,
    document_versions json,
    etag text NOT NULL,
    external_properties json,
    filename text NOT NULL,
    locked boolean,
    matter_id uuid,
    name text NOT NULL,
    parent_created_at timestamp without time zone,
    parent_deleted_at timestamp without time zone,
    parent_etag text,
    parent_id text,
    parent_locked boolean,
    parent_name text,
    parent_root boolean,
    parent_type text,
    parent_updated_at timestamp without time zone,
    received_at timestamp without time zone,
    size integer,
    type text NOT NULL,
    updated_at timestamp without time zone,
    document_type text,
    in_gcp boolean,
    ext text,
    PRIMARY KEY (id),
    FOREIGN KEY (client_profile_id) REFERENCES person(profile_id),
    FOREIGN KEY (matter_id) REFERENCES matter(matter_id)
);

CREATE TABLE court (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    us_state text,
    state_specific_data json,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    county text,
    district text,
    filing_type text,
    court_type text,
    PRIMARY KEY (id)
);

CREATE TABLE court_contact (
    id integer NOT NULL,
    location_code text,
    display_name text,
    address text,
    email text,
    contact_name text,
    phone text,
    notes text,
    court_contact_id uuid DEFAULT gen_random_uuid(),
    us_state text,
    court_id uuid,
    PRIMARY KEY (id),
    FOREIGN KEY (court_id) REFERENCES court(id)
);

CREATE TABLE court_data_lookup (
    id integer NOT NULL,
    profile_id text,
    contents json,
    PRIMARY KEY (id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id)
);

CREATE TABLE court_fee (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    legal_action_type text NOT NULL,
    fee_type text NOT NULL,
    amount numeric,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE court_to_court_fee (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    court_id uuid NOT NULL,
    court_fee_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (court_fee_id) REFERENCES court_fee(id),
    FOREIGN KEY (court_id) REFERENCES court(id)
);

CREATE TABLE docket_extraction_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    extracted_data jsonb,
    client_document_id uuid,
    person_case_id uuid,
    corrections jsonb,
    PRIMARY KEY (id),
    FOREIGN KEY (client_document_id) REFERENCES client_document(id)
);

CREATE TABLE document_edits (
    id integer NOT NULL,
    client_profile_id text,
    case_number text,
    document_type text,
    edits text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    us_state text,
    services_bundle_id uuid,
    PRIMARY KEY (id),
    FOREIGN KEY (client_profile_id) REFERENCES person(profile_id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id),
    FOREIGN KEY (services_bundle_id) REFERENCES services_bundle(id)
);

CREATE TABLE document_edits_expungement (
    id integer NOT NULL,
    profile_id text,
    case_number text,
    first_name text,
    last_name text,
    birth_date text,
    title text,
    judge_name text,
    bci_cert_number text,
    other_edits text,
    location_code text,
    court_name text,
    county text,
    case_number_unknown text,
    PRIMARY KEY (id)
);

CREATE TABLE docusign_envelope (
    id uuid NOT NULL,
    profile_id text,
    type text,
    envelope_id text,
    created_at timestamp with time zone,
    modified_at timestamp with time zone,
    envelope_sent_at timestamp with time zone,
    envelope_completed_at timestamp with time zone,
    recipient_completed_at timestamp with time zone,
    recipient_sent_at timestamp with time zone,
    status text,
    client_document_id uuid,
    sent_via text,
    sent_to text,
    PRIMARY KEY (id),
    FOREIGN KEY (client_document_id) REFERENCES client_document(id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id)
);

CREATE TABLE fee_waiver (
    id integer NOT NULL,
    client_profile_id text,
    reason_main text,
    reason_detail text,
    is_deleted boolean DEFAULT false,
    is_seeking_waiver boolean DEFAULT false,
    fee_waiver_status text DEFAULT 'N/A'::text,
    court_fee_status text DEFAULT 'N/A'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone,
    court_fee_grant_other text,
    permission_to_sign boolean DEFAULT false,
    judge_name text,
    location_code text,
    court_name text,
    county text,
    PRIMARY KEY (id),
    FOREIGN KEY (client_profile_id) REFERENCES person(profile_id)
);

CREATE TABLE giveaway_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id text NOT NULL,
    product_name text,
    partnership_payor_id uuid,
    quantity integer,
    unit_price numeric,
    amount numeric,
    status text,
    committed_at timestamp with time zone,
    invoiced_at timestamp with time zone,
    paid_at timestamp with time zone,
    performed_at timestamp with time zone,
    deleted_at timestamp with time zone,
    outcome text,
    services_bundle_id uuid,
    invoice_id uuid,
    matter_id uuid,
    us_state text,
    stripe_invoice_id text,
    stripe_price_id text,
    hired_at timestamp with time zone,
    PRIMARY KEY (id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id)
);

CREATE TABLE greenfiling_document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    document_status text,
    greenfiling_name text,
    rasa_name text,
    document_type text,
    clio_document_id text,
    PRIMARY KEY (id),
    FOREIGN KEY (email_id) REFERENCES greenfiling_email(id)
);

CREATE TABLE greenfiling_email (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_id text NOT NULL,
    subject text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sent_at timestamp with time zone NOT NULL,
    category text NOT NULL,
    email_status text,
    document_line text,
    location_code text,
    PRIMARY KEY (id)
);

CREATE TABLE invoice (
    id uuid NOT NULL,
    profile_id text,
    invoice_status text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    invoice_stripe_id text,
    us_state text,
    client_document_id uuid,
    paid_at timestamp with time zone,
    amount numeric,
    invoice_number text,
    services_bundle_id uuid,
    memo text,
    payor_id uuid,
    type text,
    PRIMARY KEY (id),
    FOREIGN KEY (client_document_id) REFERENCES client_document(id),
    FOREIGN KEY (payor_id) REFERENCES partnership_contract(id),
    FOREIGN KEY (services_bundle_id) REFERENCES services_bundle(id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id)
);

CREATE TABLE invoice_line_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    line_item_id uuid,
    matter_id uuid,
    invoice_id uuid,
    stripe_invoice_number text,
    stripe_invoice_id text,
    stripe_product_name text,
    stripe_price_id text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (invoice_id) REFERENCES invoice(id),
    FOREIGN KEY (line_item_id) REFERENCES line_item(id),
    FOREIGN KEY (matter_id) REFERENCES matter(matter_id)
);

CREATE TABLE legal_decision (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id text,
    legal_action_type text NOT NULL,
    decision text,
    case_number text,
    admin_email_added text,
    admin_email_deleted text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone,
    PRIMARY KEY (id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id)
);

CREATE TABLE line_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id text,
    payor_id uuid,
    matter_id uuid,
    services_bundle_id uuid,
    line_item_type_name text,
    price numeric,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    PRIMARY KEY (id),
    FOREIGN KEY (line_item_type_name) REFERENCES line_item_type(name),
    FOREIGN KEY (matter_id) REFERENCES matter(matter_id),
    FOREIGN KEY (payor_id) REFERENCES partnership_contract(id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id),
    FOREIGN KEY (services_bundle_id) REFERENCES services_bundle(id)
);

CREATE TABLE line_item_type (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    label text,
    line_item_category text,
    default_price numeric,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone,
    us_state text,
    fee_type text,
    default_stripe_price_id text,
    PRIMARY KEY (id)
);

CREATE TABLE matter (
    id integer NOT NULL,
    client_profile_id text,
    display_name text,
    case_number text,
    legal_action_type text,
    current_status text,
    matter_life_cycle text,
    notes text,
    bci_submitted timestamp without time zone,
    description text,
    clio_client_id text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    open_date timestamp without time zone,
    closed_date timestamp without time zone,
    pending_date timestamp without time zone,
    bci_cert_exp timestamp without time zone,
    bci_cert_number text,
    paid_in_full timestamp without time zone,
    bci_submitted_2 timestamp without time zone,
    req_personal_statement timestamp without time zone,
    received_personal_statement timestamp without time zone,
    docs_drawn timestamp without time zone,
    docs_filed timestamp without time zone,
    bci_app_sent_to_client timestamp without time zone,
    total_amount_paid integer,
    request_to_submit_deadline timestamp without time zone,
    mou_grant_ins_paid integer,
    objection timestamp without time zone,
    order_signed timestamp without time zone,
    stipulation timestamp without time zone,
    bci_confirmation_letter timestamp without time zone,
    disengagement_letter timestamp without time zone,
    final_docs_sent timestamp without time zone,
    bci_determination_received timestamp without time zone,
    review_obtained timestamp without time zone,
    is_deleted boolean DEFAULT false,
    matter_id uuid DEFAULT gen_random_uuid(),
    is_bci_cert_charge boolean DEFAULT false,
    us_state text,
    is_two_step boolean,
    clio_matter_id text,
    clio_description text,
    new_case_number text,
    is_closed boolean,
    closed_reason text,
    is_granted boolean,
    workflow text,
    workflow_stage text,
    state_specific_data json,
    workflow_step_name text,
    workflow_id uuid,
    court_id uuid,
    services_bundle_id uuid,
    added_by_services_bundle_id uuid,
    removed_by_services_bundle_id uuid,
    clio_workflow_stage_updated_at timestamp with time zone,
    clio_maildrop_address text,
    workflow_name text,
    workflow_step_change_at timestamp with time zone,
    workflow_step_changed_at date,
    granted_date date,
    filed_date date,
    lead_charge_description text,
    lead_charge_severity text,
    lead_charge_disposition text,
    PRIMARY KEY (id),
    FOREIGN KEY (client_profile_id) REFERENCES person(profile_id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id),
    FOREIGN KEY (added_by_services_bundle_id) REFERENCES services_bundle(id),
    FOREIGN KEY (court_id) REFERENCES court(id),
    FOREIGN KEY (removed_by_services_bundle_id) REFERENCES services_bundle(id),
    FOREIGN KEY (services_bundle_id) REFERENCES services_bundle(id),
    FOREIGN KEY (workflow_id) REFERENCES workflow(id)
);

CREATE TABLE matter_change_event (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    operation text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    old_value text,
    new_value text,
    matter_id uuid,
    matter_note_id uuid,
    PRIMARY KEY (id),
    FOREIGN KEY (matter_id) REFERENCES matter(matter_id),
    FOREIGN KEY (matter_note_id) REFERENCES matter_note(id)
);

CREATE TABLE matter_fee_waiver (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fee_waiver_status text,
    court_fee_status text,
    matter_matter_id uuid,
    PRIMARY KEY (id),
    FOREIGN KEY (matter_matter_id) REFERENCES matter(matter_id)
);

CREATE TABLE matter_note (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    matter_id uuid,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    content text,
    PRIMARY KEY (id),
    FOREIGN KEY (matter_id) REFERENCES matter(matter_id)
);

CREATE TABLE message (
    id uuid NOT NULL,
    profile_id text NOT NULL,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    body text,
    type text,
    contact_media text,
    PRIMARY KEY (id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id)
);

CREATE TABLE partnership_contract (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    contact_name text,
    phone text,
    phone_ext text,
    email text,
    address text,
    address2 text,
    city text,
    state text,
    zip text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    closed boolean,
    closed_at timestamp with time zone,
    coverage_type text,
    initial_amount numeric,
    current_uncommitted numeric,
    us_states_covered jsonb,
    description_internal text,
    description_external text,
    funding_type text,
    name_abbr text,
    utm_code text,
    PRIMARY KEY (id)
);

CREATE TABLE partnership_to_matter (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    matter_id uuid NOT NULL,
    partnership_contract_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (matter_id) REFERENCES matter(matter_id),
    FOREIGN KEY (partnership_contract_id) REFERENCES partnership_contract(id)
);

CREATE TABLE partnership_to_person (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_profile_id text NOT NULL,
    partnership_contract_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    roi_docusign_envelope_id uuid,
    PRIMARY KEY (id),
    FOREIGN KEY (client_profile_id) REFERENCES person(profile_id),
    FOREIGN KEY (partnership_contract_id) REFERENCES partnership_contract(id),
    FOREIGN KEY (roi_docusign_envelope_id) REFERENCES docusign_envelope(id)
);

CREATE TABLE payment_attempt (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text,
    status text,
    memo text,
    transaction_id text,
    product_name text,
    product_id text,
    price_id text,
    amount numeric,
    profile_id text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id)
);

CREATE TABLE payment_plan (
    id integer NOT NULL,
    client_profile_id text,
    number_of_payments text,
    frequency_of_payments text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    payments text,
    us_state text,
    PRIMARY KEY (id)
);

CREATE TABLE person (
    id integer NOT NULL,
    profile_id text,
    birth_date date,
    first_name text,
    last_name text,
    email text,
    phone text,
    address text,
    address2 text,
    city text,
    state text,
    zip text,
    clio_id text,
    app_payment_type text,
    app_payment_date timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    app_payment_stripe_id text,
    app_payment_transaction_id text,
    role text,
    status text,
    num_expungements integer,
    verification_type text,
    verified boolean,
    eligible boolean,
    records_found boolean,
    referral_source text,
    utm_code text,
    hired_us boolean,
    current_status text,
    contact_lifecycle text,
    practice_area text,
    payment_source text,
    practice_group text,
    source_category text,
    billing_total integer,
    hashed_password text,
    num_402s integer,
    client_status text,
    court_data_lookup json,
    title text,
    has_seen_results boolean,
    freshworks_id text,
    app_payment_amount integer,
    us_state text,
    referral_other text,
    signup_status text,
    app_payment_coupon_code text,
    peer_referral_code text,
    peer_referrer_profile_id text,
    middle_name text,
    workflow_name text,
    workflow_step_name text,
    workflow_step_change_at timestamp with time zone,
    state_specific_data json,
    salesperson_id uuid,
    language text DEFAULT 'en'::text,
    opt_in_email boolean DEFAULT false,
    opt_in_sms boolean DEFAULT false,
    PRIMARY KEY (id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id),
    FOREIGN KEY (salesperson_id) REFERENCES salesperson(id)
);

CREATE TABLE person_additional (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    label text NOT NULL,
    value text,
    type text,
    PRIMARY KEY (id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id)
);

CREATE TABLE person_answer (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    question text,
    selection text,
    additional_json json,
    PRIMARY KEY (id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id)
);

CREATE TABLE person_case (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    us_state text,
    case_number text,
    case_type text,
    court text,
    filing_date date,
    incident_date date,
    probation_ordered boolean,
    probation_end_date date,
    incarceration_ordered boolean,
    incarceration_end_date date,
    fine_restitution_ordered boolean,
    fine_restitution_amount integer,
    source text,
    court_id uuid,
    case_key text,
    closed_date date,
    deleted boolean DEFAULT false,
    county text,
    originating_case_number text,
    probation_duration text,
    incarceration_duration text,
    PRIMARY KEY (id),
    FOREIGN KEY (court_id) REFERENCES court(id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id)
);

CREATE TABLE person_change_event (
    id integer NOT NULL,
    profile_id text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    operation text,
    old_value text,
    new_value text,
    person_note_id uuid,
    admin_email text,
    PRIMARY KEY (id),
    FOREIGN KEY (person_note_id) REFERENCES person_note(id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id)
);

CREATE TABLE person_charge (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_case_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    charge_count integer,
    charge_code text,
    description text,
    severity text,
    disposition text,
    disposition_date date,
    count_number integer,
    deleted boolean DEFAULT false,
    PRIMARY KEY (id),
    FOREIGN KEY (person_case_id) REFERENCES person_case(id)
);

CREATE TABLE person_integration (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    profile_id text,
    service text,
    external_id text,
    PRIMARY KEY (id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id)
);

CREATE TABLE person_note (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    content text,
    PRIMARY KEY (id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id)
);

CREATE TABLE personal_statement (
    id integer NOT NULL,
    profile_id text,
    first_name text,
    last_name text,
    birth_date text,
    personal_statement text,
    document_type text,
    generated_statement text,
    approved_by_1 text,
    approved_by_2 text,
    PRIMARY KEY (id)
);

CREATE TABLE product (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE prosecuting_agency_display_names (
    id integer NOT NULL,
    prosec_agency text,
    display_name text,
    city text,
    county text,
    prosec_name text,
    address text,
    email text,
    prosec_desc text,
    city_state_zip text,
    PRIMARY KEY (id)
);

CREATE TABLE record (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id text NOT NULL,
    us_state text NOT NULL,
    amount_owed numeric,
    state_specific_data json,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id)
);

CREATE TABLE salesperson (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    ordinal integer,
    is_current boolean DEFAULT false,
    is_active boolean DEFAULT true,
    hubspot_id text,
    email text,
    freshworks_id text,
    PRIMARY KEY (id)
);

CREATE TABLE services_bundle (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id text NOT NULL,
    parent_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    type text,
    ordinal integer,
    status text,
    client_document_id uuid,
    us_state text,
    PRIMARY KEY (id),
    FOREIGN KEY (client_document_id) REFERENCES client_document(id),
    FOREIGN KEY (parent_id) REFERENCES services_bundle(id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id)
);

CREATE TABLE survey (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    type text,
    answers json,
    PRIMARY KEY (id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id)
);

CREATE TABLE temp_af (
    profile_id text,
    report_status text,
    name text,
    email text,
    ask_hollee boolean,
    client_status text,
    giveaway_count integer
);

CREATE TABLE temp_af_cleanup (
    profile_id text
);

CREATE TABLE temp_af_giveaway_items (
    profile_id text,
    name text,
    quantity integer,
    product_name text
);

CREATE TABLE temp_af_matters (
    id integer NOT NULL,
    matter_id uuid,
    profile_id text,
    description text,
    lead_charge_severity text,
    lead_charge_disposition text,
    lead_charge_description text,
    name text,
    legal_action_type text,
    case_number text,
    PRIMARY KEY (id),
    FOREIGN KEY (matter_id) REFERENCES matter(matter_id),
    FOREIGN KEY (profile_id) REFERENCES temp_af(profile_id)
);

CREATE TABLE temp_client_status_type (
    name text NOT NULL,
    type text
);

CREATE TABLE third_parties (
    id integer NOT NULL,
    name text,
    email text,
    phone text,
    client_profile_id text,
    deleted_at text DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (client_profile_id) REFERENCES person(profile_id),
    FOREIGN KEY (profile_id) REFERENCES person(profile_id)
);

CREATE TABLE workflow (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    us_state text,
    type text,
    display_name text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE workflow_action (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    property_name text,
    deadline_property_name text,
    deadline_offset_days integer,
    description text,
    next_workflow_step_name text,
    is_deleted boolean,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    property_display_name text,
    deadline_property_display_name text,
    action_type text,
    property_to_check text,
    workflow_name text,
    required_workflow_step text,
    PRIMARY KEY (id)
);

CREATE TABLE workflow_display (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    us_state text,
    PRIMARY KEY (id)
);

CREATE TABLE workflow_display_step (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    display_label text,
    display_ordinal text,
    workflow_display uuid,
    PRIMARY KEY (id)
);

CREATE TABLE workflow_option (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    display_name text,
    description text,
    type text,
    ordinal integer,
    workflow_step_name text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE workflow_option_to_action (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_option_id uuid NOT NULL,
    workflow_action_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (workflow_action_id) REFERENCES workflow_action(id),
    FOREIGN KEY (workflow_option_id) REFERENCES workflow_option(id)
);

CREATE TABLE workflow_step (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    fw_name text,
    ordinal integer,
    workflow_id uuid,
    display_step uuid,
    display_name text,
    workflow_name text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (workflow_id) REFERENCES workflow(id)
);