# Libraries
import os
import sys
from typing import List
import secrets

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware

# Modules
from pydantic import BaseModel
from app.logger import setup_logging, exception_handler
from app.postgres_ssh_connector import execute_query_with_env_vars, execute_transaction_with_env_vars

# FastAPI App Setup
app = FastAPI(title="Local Job Processor API")

SESSION_TOKEN = os.getenv("APP_SESSION_SECRET") or secrets.token_urlsafe(32)

def verify_session_token(x_session_token: str = Header(None, alias="X-Session-Token")):
    if not x_session_token or x_session_token != SESSION_TOKEN:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: Invalid or missing session token"
        )

allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
if allowed_origins_env:
    allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
else:
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Session-Token", "X-Requested-With"],
)

setup_logging("project_errors.log")
sys.excepthook = exception_handler

@app.get("/api/auth/token")
async def get_auth_token():
    """Provides the active session token to the browser frontend upon page load."""
    return {"token": SESSION_TOKEN}

############################## Data Viewer Queries ####################################

NAMED_QUERIES = {
    "all_jobs": {
        "sql": "SELECT id, skip, job_name, job_summary, date_added, pay_range, flexibility, link, source FROM job LIMIT 100",
        "tables": {
            "job": {"pk_field": "id", "columns": ["id", "skip", "job_name", "job_summary", "date_added", "pay_range", "flexibility", "link", "source"]}
        },
        "column_types": {
            "id": "integer",
            "skip": "boolean",
            "job_name": "varchar",
            "job_summary": "text",
            "date_added": "date",
            "pay_range": "varchar",
            "flexibility": "varchar",
            "link": "varchar",
            "source": "varchar"
        }
    },
    "apply_queue": {
        "sql": """
            SELECT 
                j.id,
                j.skip,
                j.date_added, 
                j.job_name, 
                c.company_name, 
                o.location, 
                j.pay_range, 
                j.flexibility, 
                j.link, 
                j.source, 
                vs.semantic_score, 
                cl.fit_score AS cheap_final_score, 
                sl.final_score AS strong_final_score, 
                sl.apply_recommendation AS strong_apply_recommendation, 
                faq.final_score AS final_application_queue_final_score, 
                sl.recruiter_bait_likelihood,
                j.applied,
                j.applied_on,
                j.rejected,
                j.rejected_on,
                j.rejected_reason
            FROM job j
            JOIN company c ON j.company_id = c.id
            LEFT JOIN office o ON j.office_id = o.id
            LEFT JOIN strong_llm_results sl ON j.id = sl.job_id
            LEFT JOIN cheap_llm_results cl ON j.id = cl.job_id
            LEFT JOIN vector_scores vs ON j.id = vs.job_id
            LEFT JOIN final_application_queue faq ON j.id = faq.job_id
            WHERE sl.apply_recommendation IN ('apply', 'maybe')
            AND (j.skip IS NULL OR j.skip = False)
            ORDER BY faq.final_score DESC;
        """,
        "tables": {
            "job": {"pk_field": "id", "columns": ["id", "job_name", "job_summary", "date_added", "pay_range", "flexibility", "link", "source", "skip","applied","applied_on","rejected","rejected_on","rejected_reason"]},
            "company": {"pk_field": "id", "columns": ["id", "company_name"]},
            "office": {"pk_field": "id", "columns": ["id", "location"]},
            "vector_scores": {"pk_field": "id", "columns": ["id", "semantic_score"]},
            "cheap_llm_results": {"pk_field": "id", "columns": ["id", "fit_score"]},
            "strong_llm_results": {"pk_field": "id", "columns": ["id", "final_score", "apply_recommendation", "recruiter_bait_likelihood"]},
            "final_application_queue": {"pk_field": "id", "columns": ["id", "final_score"]}
        },
        "column_types": {
            "id": "integer",
            "skip": "boolean",
            "date_added": "date",
            "job_name": "varchar",
            "company_name": "varchar",
            "location": "varchar",
            "pay_range": "varchar",
            "flexibility": "varchar",
            "link": "varchar",
            "source": "varchar",
            "semantic_score": "float",
            "cheap_final_score": "float",
            "strong_final_score": "float",
            "strong_apply_recommendation": "varchar",
            "final_application_queue_final_score": "float",
            "recruiter_bait_likelihood": "boolean",
            "applied": "boolean",
            "applied_on": "date",
            "rejected": "boolean",
            "rejected_on": "date",
            "rejected_reason": "varchar"
        }
    },
    "jobs_with_companies": {
        "sql": """
            SELECT 
                j.id AS job_id, 
                j.date_added, 
                j.job_name, 
                c.company_name, 
                o.location, 
                j.pay_range, 
                j.flexibility, 
                j.link, 
                j.source,
                j.job_summary,
                j.applied,
                j.applied_on,
                j.rejected,
                j.rejected_on,
                j.rejected_reason
            FROM job j 
            LEFT JOIN company c ON j.company_id = c.id
            LEFT JOIN office o ON j.office_id = o.id
            WHERE (%(job_title)s = '%%' OR j.job_name ILIKE %(job_title)s)
            AND (%(company_name)s = '%%' OR c.company_name ILIKE %(company_name)s)
            LIMIT %(limit)s
        """,
        "parameters": {
            "job_title": {
                "label": "Job Title Filter",
                "type": "string",
                "default": "",
                "placeholder": "e.g. Engineer, Manager..."
            },
            "company_name": {
                "label": "Company Filter",
                "type": "string",
                "default": "",
                "placeholder": "e.g. Acme, Tech..."
            },
            "limit": {
                "label": "Max Rows",
                "type": "integer",
                "default": 100,
                "placeholder": "100"
            }
        },
        "tables": {
            "job": {"pk_field": "job_id", "columns": ["job_name", "job_summary", "date_added", "pay_range", "flexibility", "link", "source","job_summary","applied","applied_on","rejected","rejected_on","rejected_reason"]},
            "company": {"pk_field": "id", "columns": ["company_name"]},
            "office": {"pk_field": "id", "columns": ["location"]}
        },
        "column_types": {
            "job_id": "integer",
            "date_added": "date",
            "job_name": "varchar",
            "company_name": "varchar",
            "location": "varchar",
            "pay_range": "varchar",
            "flexibility": "varchar",
            "link": "varchar",
            "source": "varchar",
            "job_summary":"varchar",
            "applied": "boolean",
            "applied_on": "date",
            "rejected": "boolean",
            "rejected_on": "date",
            "rejected_reason": "varchar"
        }
    },
    "jobs_by_date": {
        "sql": """
            SELECT 
                j.id,
                j.skip,
                j.date_added, 
                j.job_name, 
                c.company_name, 
                o.location, 
                j.pay_range, 
                j.flexibility, 
                j.link, 
                j.source, 
                j.job_summary,
                j.requirements,
                j.responsibilities,
                vs.semantic_score, 
                cl.fit_score AS cheap_final_score, 
                sl.final_score AS strong_final_score, 
                sl.apply_recommendation AS strong_apply_recommendation, 
                faq.final_score AS final_application_queue_final_score, 
                sl.recruiter_bait_likelihood,
                j.applied,
                j.applied_on,
                j.rejected,
                j.rejected_on,
                j.rejected_reason
            FROM job j
            JOIN company c ON j.company_id = c.id
            LEFT JOIN office o ON j.office_id = o.id
            LEFT JOIN strong_llm_results sl ON j.id = sl.job_id
            LEFT JOIN cheap_llm_results cl ON j.id = cl.job_id
            LEFT JOIN vector_scores vs ON j.id = vs.job_id
            LEFT JOIN final_application_queue faq ON j.id = faq.job_id
            WHERE (%(job_title)s = '%%' OR j.job_name ILIKE %(job_title)s)
            AND (%(company_name)s = '%%' OR c.company_name ILIKE %(company_name)s)
            AND (
                %(filter_date)s IS NULL
                OR (%(date_mode)s = 'on' AND j.date_added::date = %(filter_date)s::date)
                OR (%(date_mode)s = 'after' AND j.date_added::date >= %(filter_date)s::date)
                OR (%(date_mode)s = 'before' AND j.date_added::date <= %(filter_date)s::date)
            )
            LIMIT %(limit)s
        """,
        "parameters": {
            "job_title": {
                "label": "Job Title Filter",
                "type": "string",
                "default": "",
                "placeholder": "e.g. Engineer, Manager..."
            },
            "company_name": {
                "label": "Company Filter",
                "type": "string",
                "default": "",
                "placeholder": "e.g. Acme, Tech..."
            },
            "date_mode": {
                "label": "Date Condition",
                "type": "select",
                "default": "after",
                "options": ["after", "on", "before"]
            },
            "filter_date": {
                "label": "Date Added",
                "type": "date",
                "default": ""
            },
            "limit": {
                "label": "Max Rows",
                "type": "integer",
                "default": 100,
                "placeholder": "100"
            }
        },
        "tables": {
            "job": {"pk_field": "id", "columns": ["id", "job_name", "job_summary", "date_added", "pay_range", "flexibility", "link", "source", "skip", "job_summary", "requirements", "responsibilities","applied","applied_on","rejected","rejected_on","rejected_reason"]},
            "company": {"pk_field": "id", "columns": ["id", "company_name"]},
            "office": {"pk_field": "id", "columns": ["id", "location"]},
            "vector_scores": {"pk_field": "id", "columns": ["id", "semantic_score"]},
            "cheap_llm_results": {"pk_field": "id", "columns": ["id", "fit_score"]},
            "strong_llm_results": {"pk_field": "id", "columns": ["id", "final_score", "apply_recommendation", "recruiter_bait_likelihood"]},
            "final_application_queue": {"pk_field": "id", "columns": ["id", "final_score"]}
        },
        "column_types": {
            "id": "integer",
            "skip": "boolean",
            "date_added": "date",
            "job_name": "varchar",
            "company_name": "varchar",
            "location": "varchar",
            "pay_range": "varchar",
            "flexibility": "varchar",
            "link": "varchar",
            "source": "varchar",
            "job_summary": "varchar",
            "requirements": "varchar",
            "responsibilities": "varchar",
            "semantic_score": "float",
            "cheap_final_score": "float",
            "strong_final_score": "float",
            "strong_apply_recommendation": "varchar",
            "final_application_queue_final_score": "float",
            "recruiter_bait_likelihood": "boolean",
            "applied": "boolean",
            "applied_on": "date",
            "rejected": "boolean",
            "rejected_on": "date",
            "rejected_reason": "varchar"
        }
    },
    "cheap_llm_analysis": {
        "sql": """
            SELECT 
                j.id AS job_id,
                j.skip AS skip,
                j.date_added, 
                j.job_name, 
                c.company_name, 
                o.location, 
                j.link,
                j.pay_range,
                clr.fit_score,
                clr.strengths,
                clr.concerns,
                clr.raw_response,
                j.applied,
                j.applied_on,
                j.rejected,
                j.rejected_on,
                j.rejected_reason
            FROM job j 
            LEFT JOIN company c ON j.company_id = c.id
            LEFT JOIN office o ON j.office_id = o.id
            JOIN cheap_llm_results clr
            ON clr.job_id = j.id
            WHERE (%(job_title)s = '%%' OR j.job_name ILIKE %(job_title)s)
            AND (%(company_name)s = '%%' OR c.company_name ILIKE %(company_name)s)
            AND (
                %(fit_score)s IS NULL
                OR (%(fit_mode)s = 'is' AND clr.fit_score = %(fit_score)s)
                OR (%(fit_mode)s = 'greater' AND clr.fit_score >= %(fit_score)s)
                OR (%(fit_mode)s = 'less' AND clr.fit_score <= %(fit_score)s)
            )
            AND (
                %(filter_date)s IS NULL
                OR (%(date_mode)s = 'on' AND j.date_added::date = %(filter_date)s::date)
                OR (%(date_mode)s = 'after' AND j.date_added::date >= %(filter_date)s::date)
                OR (%(date_mode)s = 'before' AND j.date_added::date <= %(filter_date)s::date)
            )
            LIMIT %(limit)s
        """,
        "parameters": {
            "job_title": {
                "label": "Job Title Filter",
                "type": "string",
                "default": "",
                "placeholder": "e.g. Engineer, Manager..."
            },
            "company_name": {
                "label": "Company Filter",
                "type": "string",
                "default": "",
                "placeholder": "e.g. Acme, Tech..."
            },
            "fit_score": {
                "label": "Fit Score",
                "type": "integer",
                "placeholder": 70,
                "default": 0
            },
            "fit_mode": {
                "label": "Fit Condition",
                "type": "select",
                "default": "greater",
                "options": ["is", "greater", "less"]

            },
            "date_mode": {
                "label": "Date Condition",
                "type": "select",
                "default": "after",
                "options": ["after", "on", "before"]
            },
            "filter_date": {
                "label": "Date Added",
                "type": "date",
                "default": ""
            },
            "limit": {
                "label": "Max Rows",
                "type": "integer",
                "default": 100,
                "placeholder": "100"
            }
        },
        "tables": {
            "job": {"pk_field": "job_id", "columns": ["job_name", "skip", "job_summary", "date_added", "pay_range", "link","applied","applied_on","rejected","rejected_on","rejected_reason"]},
            "company": {"pk_field": "id", "columns": ["company_name"]},
            "office": {"pk_field": "id", "columns": ["location"]},
            "cheap_llm_results": {"pk_field": "id", "columns": ["id", "fit_score", "strengths", "concerns", "raw_response"]},
        },
        "column_types": {
            "job_id": "integer",
            "skip": "boolean",
            "date_added": "date",
            "job_name": "varchar",
            "company_name": "varchar",
            "location": "varchar",
            "pay_range": "varchar",
            "link": "varchar",
            "fit_score": "integer",
            "strengths": "varchar",
            "concerns": "varchar",
            "applied": "boolean",
            "applied_on": "date",
            "rejected": "boolean",
            "rejected_on": "date",
            "rejected_reason": "varchar",
            "raw_response": "varchar"
        }
    },
    "strong_llm_analysis": {
        "sql": """
            SELECT 
                j.id AS job_id, 
                j.skip AS skip,
                j.date_added, 
                j.job_name, 
                c.company_name, 
                o.location, 
                j.link,
                j.pay_range,
                slr.final_score,
                slr.recruiter_bait_likelihood,
                slr.apply_recommendation,
                slr.priority,
                slr.red_flags,
                slr.tailoring_notes,
                slr.detailed_fit_analysis,
                slr.raw_response,
                j.applied,
                j.applied_on,
                j.rejected,
                j.rejected_on,
                j.rejected_reason
            FROM job j 
            LEFT JOIN company c ON j.company_id = c.id
            LEFT JOIN office o ON j.office_id = o.id
            JOIN strong_llm_results slr
            ON slr.job_id = j.id
            WHERE (%(job_title)s = '%%' OR j.job_name ILIKE %(job_title)s)
            AND (%(company_name)s = '%%' OR c.company_name ILIKE %(company_name)s)
            AND (
                %(final_score)s IS NULL
                OR (%(final_mode)s = 'is' AND slr.final_score = %(final_score)s)
                OR (%(final_mode)s = 'greater' AND slr.final_score >= %(final_score)s)
                OR (%(final_mode)s = 'less' AND slr.final_score <= %(final_score)s)
            )
            AND (
                %(filter_date)s IS NULL
                OR (%(date_mode)s = 'on' AND j.date_added::date = %(filter_date)s::date)
                OR (%(date_mode)s = 'after' AND j.date_added::date >= %(filter_date)s::date)
                OR (%(date_mode)s = 'before' AND j.date_added::date <= %(filter_date)s::date)
            )
            LIMIT %(limit)s
        """,
        "parameters": {
            "job_title": {
                "label": "Job Title Filter",
                "type": "string",
                "default": "",
                "placeholder": "e.g. Engineer, Manager..."
            },
            "company_name": {
                "label": "Company Filter",
                "type": "string",
                "default": "",
                "placeholder": "e.g. Acme, Tech..."
            },
            "final_score": {
                "label": "Final Score",
                "type": "integer",
                "placeholder": 70,
                "default": 0
            },
            "final_mode": {
                "label": "Final Condition",
                "type": "select",
                "default": "greater",
                "options": ["is", "greater", "less"]
            },
            "date_mode": {
                "label": "Date Condition",
                "type": "select",
                "default": "after",
                "options": ["after", "on", "before"]
            },
            "filter_date": {
                "label": "Date Added",
                "type": "date",
                "default": ""
            },
            "limit": {
                "label": "Max Rows",
                "type": "integer",
                "default": 100,
                "placeholder": "100"
            }
        },
        "tables": {
            "job": {"pk_field": "job_id", "columns": ["job_name", "skip", "job_summary", "date_added", "pay_range", "link","applied","applied_on","rejected","rejected_on","rejected_reason"]},
            "company": {"pk_field": "id", "columns": ["company_name"]},
            "office": {"pk_field": "id", "columns": ["location"]},
            "strong_llm_results": {"pk_field": "id", "columns": ["id", "final_score", "recruiter_bait_likelihood", "apply_recommendation", "priority", "red_flags", "tailoring_notes", "detailed_fit_analysis","raw_response"]},
        },
        "column_types": {
            "job_id": "integer",
            "skip": "boolean",
            "date_added": "date",
            "job_name": "varchar",
            "company_name": "varchar",
            "location": "varchar",
            "pay_range": "varchar",
            "link": "varchar",
            "final_score": "integer", 
            "recruiter_bait_likelihood": "varchar", 
            "apply_recommendation": "varchar", 
            "priority": "varchar", 
            "red_flags": "varchar", 
            "tailoring_notes": "varchar", 
            "detailed_fit_analysis": "varchar",
            "applied": "boolean",
            "applied_on": "date",
            "rejected": "boolean",
            "rejected_on": "date",
            "rejected_reason": "varchar",
            "raw_response": "varchar"
        }
    },
    "jobs_applied": {
        "sql": """
            SELECT 
                j.id AS job_id, 
                j.date_added, 
                j.job_name, 
                c.company_name, 
                o.location, 
                j.pay_range, 
                j.flexibility, 
                j.link, 
                j.source,
                j.job_summary,
                j.applied,
                j.applied_on,
                j.rejected,
                j.rejected_on,
                j.rejected_reason
            FROM job j 
            LEFT JOIN company c ON j.company_id = c.id
            LEFT JOIN office o ON j.office_id = o.id
            WHERE j.applied = True
            ORDER BY j.applied_on DESC
            LIMIT %(limit)s;
        """,
        "parameters": {
            "limit": {
                "label": "Max Rows",
                "type": "integer",
                "default": 100,
                "placeholder": "100"
            }
        },
        "tables": {
            "job": {"pk_field": "job_id", "columns": ["job_name", "job_summary", "date_added", "pay_range", "flexibility", "link", "source","job_summary","applied","applied_on","rejected","rejected_on","rejected_reason"]},
            "company": {"pk_field": "id", "columns": ["company_name"]},
            "office": {"pk_field": "id", "columns": ["location"]}
        },
        "column_types": {
            "job_id": "integer",
            "date_added": "date",
            "job_name": "varchar",
            "company_name": "varchar",
            "location": "varchar",
            "pay_range": "varchar",
            "flexibility": "varchar",
            "link": "varchar",
            "source": "varchar",
            "job_summary":"varchar",
            "applied": "boolean",
            "applied_on": "date",
            "rejected": "boolean",
            "rejected_on": "date",
            "rejected_reason": "varchar"
        }
    },
    "jobs_rejected_from": {
        "sql": """
            SELECT 
                j.id AS job_id, 
                j.date_added, 
                j.job_name, 
                c.company_name, 
                o.location, 
                j.pay_range, 
                j.flexibility, 
                j.link, 
                j.source,
                j.job_summary,
                j.applied,
                j.applied_on,
                j.rejected,
                j.rejected_on,
                j.rejected_reason
            FROM job j 
            LEFT JOIN company c ON j.company_id = c.id
            LEFT JOIN office o ON j.office_id = o.id
            WHERE j.rejected = True
            ORDER BY j.rejected_on ASC
            LIMIT %(limit)s;
        """,
        "parameters": {
            "limit": {
                "label": "Max Rows",
                "type": "integer",
                "default": 100,
                "placeholder": "100"
            }
        },
        "tables": {
            "job": {"pk_field": "job_id", "columns": ["job_name", "job_summary", "date_added", "pay_range", "flexibility", "link", "source","job_summary","applied","applied_on","rejected","rejected_on","rejected_reason"]},
            "company": {"pk_field": "id", "columns": ["company_name"]},
            "office": {"pk_field": "id", "columns": ["location"]}
        },
        "column_types": {
            "job_id": "integer",
            "date_added": "date",
            "job_name": "varchar",
            "company_name": "varchar",
            "location": "varchar",
            "pay_range": "varchar",
            "flexibility": "varchar",
            "link": "varchar",
            "source": "varchar",
            "job_summary":"varchar",
            "applied": "boolean",
            "applied_on": "date",
            "rejected": "boolean",
            "rejected_on": "date",
            "rejected_reason": "varchar"
        }
    }
}

class FetchDataRequest(BaseModel):
    query_name: str
    params: dict = {}

class UpdateRowData(BaseModel):
    row_data: dict
    updated_fields: dict

class UpdateDataRequest(BaseModel):
    query_name: str
    updates: List[UpdateRowData]


############################## API Endpoints ####################################



@app.post("/api/data/fetch", dependencies=[Depends(verify_session_token)])
async def fetch_data(request: FetchDataRequest):
    query_config = NAMED_QUERIES.get(request.query_name)
    if not query_config:
        raise HTTPException(status_code=404, detail="Query not found")
    
    params_config = query_config.get("parameters", {})
    query_params = {}
    
    if params_config:
        for param_name, param_meta in params_config.items():
            default_val = param_meta.get("default", "")
            user_val = request.params.get(param_name) if request.params else None
            val = user_val if user_val is not None else default_val
            
            # Format string filters with wildcards for ILIKE queries if non-empty
            if param_meta.get("type") == "string":
                query_params[param_name] = f"%{val}%" if val else "%"
            elif param_meta.get("type") == "integer":
                try:
                    query_params[param_name] = int(val) if (val != "" and val is not None) else 100
                except (ValueError, TypeError):
                    query_params[param_name] = 100
            elif param_meta.get("type") == "date":
                query_params[param_name] = val if (val != "" and val is not None) else None
            else:
                query_params[param_name] = val if val != "" else None
    
    try:
        sql = query_config["sql"]
        if params_config:
            results = execute_query_with_env_vars(sql, query_params)
        else:
            results = execute_query_with_env_vars(sql)
            
        return {
            "data": results,
            "total_rows": len(results),
            "column_types": query_config.get("column_types", {}),
            "parameters": params_config
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@app.post("/api/data/update", dependencies=[Depends(verify_session_token)])
async def update_data(request: UpdateDataRequest):
    query_config = NAMED_QUERIES.get(request.query_name)
    if not query_config:
        raise HTTPException(status_code=404, detail="Query not found")
    
    tables_config = query_config.get("tables", {})
    queries_and_params = []
    
    for update in request.updates:
        row_data = update.row_data
        updated_fields = update.updated_fields
        
        for table_name, table_info in tables_config.items():
            pk_field = table_info["pk_field"]
            table_columns = table_info["columns"]
            
            # Find fields in updated_fields that belong to this table
            fields_to_update = {k: v for k, v in updated_fields.items() if k in table_columns}
            
            if fields_to_update:
                pk_value = row_data.get(pk_field)
                if pk_value is None:
                    if pk_field == "id" and f"{table_name}_id" in row_data:
                        pk_value = row_data[f"{table_name}_id"]
                    elif pk_field.endswith("_id") and "id" in row_data:
                        pk_value = row_data["id"]

                if pk_value is None:
                    raise HTTPException(status_code=400, detail=f"Missing primary key {pk_field} for table {table_name}")
                
                set_clauses = []
                params = []
                
                for k, v in fields_to_update.items():
                    set_clauses.append(f"{k} = %s")
                    params.append(v)
                
                # Add primary key to params for WHERE clause
                params.append(pk_value)
                
                sql = f"UPDATE {table_name} SET {', '.join(set_clauses)} WHERE id = %s"
                queries_and_params.append((sql, tuple(params)))
    
    if not queries_and_params:
        return {"status": "success", "message": "No updates required"}
        
    try:
        execute_transaction_with_env_vars(queries_and_params)
        return {"status": "success", "message": "Changes saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error during update: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
