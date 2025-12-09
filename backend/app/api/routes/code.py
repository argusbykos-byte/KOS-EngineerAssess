"""
API routes for code execution.
Provides sandboxed Python code execution for candidates to test their solutions.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.services.code_executor import code_executor, ExecutionResult

router = APIRouter()


class CodeExecutionRequest(BaseModel):
    """Request body for code execution"""
    code: str = Field(..., description="Python code to execute", max_length=50000)
    sample_data_key: Optional[str] = Field(
        None,
        description="Key for pre-defined sample data (e.g., 'ppg_signal', 'accelerometer')"
    )


class CodeExecutionResponse(BaseModel):
    """Response body for code execution"""
    success: bool
    output: str
    error: Optional[str] = None
    execution_time_ms: float
    sample_data_used: Optional[str] = None


# Pre-defined sample datasets for coding challenges
SAMPLE_DATASETS = {
    "ppg_signal": {
        "ppg_signal": [
            0.52, 0.54, 0.58, 0.65, 0.75, 0.88, 0.98, 1.05, 1.08, 1.06,
            1.01, 0.94, 0.85, 0.76, 0.68, 0.61, 0.56, 0.53, 0.51, 0.50,
            0.51, 0.53, 0.57, 0.64, 0.74, 0.87, 0.97, 1.04, 1.07, 1.05,
            1.00, 0.93, 0.84, 0.75, 0.67, 0.60, 0.55, 0.52, 0.50, 0.49,
            0.50, 0.52, 0.56, 0.63, 0.73, 0.86, 0.96, 1.03, 1.06, 1.04
        ],
        "sampling_rate": 100,  # Hz
        "description": "PPG signal sample (50 samples at 100Hz = 0.5 seconds)"
    },
    "ppg_multichannel": {
        "red_signal": [
            0.45, 0.48, 0.53, 0.61, 0.72, 0.85, 0.95, 1.02, 1.05, 1.03,
            0.98, 0.90, 0.81, 0.72, 0.64, 0.57, 0.52, 0.48, 0.46, 0.45,
            0.46, 0.49, 0.54, 0.62, 0.73, 0.86, 0.96, 1.03, 1.06, 1.04,
            0.99, 0.91, 0.82, 0.73, 0.65, 0.58, 0.53, 0.49, 0.47, 0.46
        ],
        "ir_signal": [
            0.55, 0.58, 0.62, 0.70, 0.80, 0.92, 1.02, 1.09, 1.12, 1.10,
            1.04, 0.96, 0.87, 0.78, 0.69, 0.62, 0.57, 0.54, 0.52, 0.51,
            0.52, 0.55, 0.59, 0.67, 0.77, 0.89, 0.99, 1.06, 1.09, 1.07,
            1.01, 0.93, 0.84, 0.75, 0.66, 0.59, 0.54, 0.51, 0.49, 0.48
        ],
        "green_signal": [
            0.35, 0.37, 0.41, 0.48, 0.58, 0.71, 0.82, 0.90, 0.93, 0.91,
            0.86, 0.79, 0.71, 0.62, 0.55, 0.48, 0.43, 0.39, 0.36, 0.35,
            0.36, 0.38, 0.42, 0.49, 0.59, 0.72, 0.83, 0.91, 0.94, 0.92,
            0.87, 0.80, 0.72, 0.63, 0.56, 0.49, 0.44, 0.40, 0.37, 0.36
        ],
        "sampling_rate": 100,
        "description": "Multi-wavelength PPG (Red, IR, Green LEDs)"
    },
    "accelerometer": {
        "accel_x": [
            0.02, 0.03, 0.05, 0.08, 0.12, 0.15, 0.12, 0.08, 0.05, 0.03,
            0.02, 0.01, -0.01, -0.03, -0.05, -0.08, -0.10, -0.08, -0.05, -0.03,
            -0.01, 0.01, 0.03, 0.06, 0.10, 0.14, 0.11, 0.07, 0.04, 0.02,
            0.01, 0.00, -0.02, -0.04, -0.07, -0.09, -0.07, -0.04, -0.02, -0.01
        ],
        "accel_y": [
            0.98, 0.97, 0.96, 0.95, 0.94, 0.93, 0.94, 0.95, 0.96, 0.97,
            0.98, 0.99, 1.00, 1.01, 1.02, 1.03, 1.02, 1.01, 1.00, 0.99,
            0.98, 0.97, 0.96, 0.95, 0.94, 0.93, 0.94, 0.95, 0.96, 0.97,
            0.98, 0.99, 1.00, 1.01, 1.02, 1.03, 1.02, 1.01, 1.00, 0.99
        ],
        "accel_z": [
            0.01, 0.02, 0.03, 0.04, 0.05, 0.04, 0.03, 0.02, 0.01, 0.00,
            -0.01, -0.02, -0.03, -0.04, -0.03, -0.02, -0.01, 0.00, 0.01, 0.02,
            0.03, 0.04, 0.05, 0.04, 0.03, 0.02, 0.01, 0.00, -0.01, -0.02,
            -0.03, -0.04, -0.03, -0.02, -0.01, 0.00, 0.01, 0.02, 0.03, 0.04
        ],
        "sampling_rate": 50,  # Hz
        "description": "3-axis accelerometer data (gravity in Y-axis, slight wrist motion)"
    },
    "noisy_signal": {
        "clean_signal": [
            1.0, 0.95, 0.81, 0.59, 0.31, 0.0, -0.31, -0.59, -0.81, -0.95,
            -1.0, -0.95, -0.81, -0.59, -0.31, 0.0, 0.31, 0.59, 0.81, 0.95,
            1.0, 0.95, 0.81, 0.59, 0.31, 0.0, -0.31, -0.59, -0.81, -0.95,
            -1.0, -0.95, -0.81, -0.59, -0.31, 0.0, 0.31, 0.59, 0.81, 0.95
        ],
        "noisy_signal": [
            1.12, 0.89, 0.78, 0.65, 0.28, -0.05, -0.25, -0.62, -0.88, -0.91,
            -1.08, -0.98, -0.75, -0.55, -0.35, 0.08, 0.28, 0.55, 0.85, 0.92,
            1.05, 0.92, 0.85, 0.62, 0.35, -0.02, -0.28, -0.65, -0.78, -0.98,
            -0.95, -0.92, -0.85, -0.62, -0.28, 0.05, 0.35, 0.55, 0.78, 0.98
        ],
        "sampling_rate": 100,
        "description": "Clean sine wave and noisy version for filtering exercises"
    },
    "heart_rate_intervals": {
        "rr_intervals_ms": [
            823, 815, 831, 842, 819, 808, 825, 837, 821, 814,
            828, 845, 817, 806, 832, 841, 823, 812, 829, 838,
            820, 809, 826, 843, 818, 811, 830, 839, 822, 813
        ],
        "description": "RR intervals in milliseconds (beat-to-beat intervals)"
    },
    "blood_glucose_readings": {
        "timestamps_hours": [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5],
        "glucose_mg_dl": [95, 102, 145, 168, 152, 128, 112, 105, 98, 94, 92],
        "meal_at_hour": 0.5,
        "description": "Post-prandial glucose response (meal at 0.5 hours)"
    },
    "spo2_calibration": {
        "ratio_of_ratios": [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4],
        "reference_spo2": [100, 99, 98, 97, 95, 93, 90, 87, 83, 78, 72],
        "description": "SpO2 calibration data: ratio of ratios (R) vs reference SpO2"
    }
}


@router.post("/execute", response_model=CodeExecutionResponse)
async def execute_code(request: CodeExecutionRequest):
    """
    Execute Python code in a sandboxed environment.

    The sandbox provides:
    - Safe built-in functions (no file/network access)
    - Common modules: math, random, json, re, collections, itertools, etc.
    - 5 second timeout
    - Output size limits

    Sample datasets available:
    - ppg_signal: Basic PPG waveform data
    - ppg_multichannel: Multi-wavelength PPG (Red, IR, Green)
    - accelerometer: 3-axis accelerometer data
    - noisy_signal: Clean and noisy signals for filtering
    - heart_rate_intervals: RR intervals for HRV analysis
    - blood_glucose_readings: Post-prandial glucose data
    - spo2_calibration: SpO2 calibration curve data
    """
    sample_data = None
    sample_data_key = None

    if request.sample_data_key:
        if request.sample_data_key not in SAMPLE_DATASETS:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown sample data key: {request.sample_data_key}. Available: {list(SAMPLE_DATASETS.keys())}"
            )
        sample_data = SAMPLE_DATASETS[request.sample_data_key]
        sample_data_key = request.sample_data_key

    result: ExecutionResult = code_executor.execute(request.code, sample_data)

    return CodeExecutionResponse(
        success=result.success,
        output=result.output,
        error=result.error,
        execution_time_ms=result.execution_time_ms,
        sample_data_used=sample_data_key
    )


@router.get("/samples")
async def list_sample_datasets():
    """
    List available sample datasets for code execution.
    """
    samples = {}
    for key, data in SAMPLE_DATASETS.items():
        # Include description and data keys
        samples[key] = {
            "description": data.get("description", "No description"),
            "variables": [k for k in data.keys() if k != "description"]
        }
    return {"samples": samples}


@router.get("/samples/{sample_key}")
async def get_sample_dataset(sample_key: str):
    """
    Get details of a specific sample dataset.
    """
    if sample_key not in SAMPLE_DATASETS:
        raise HTTPException(
            status_code=404,
            detail=f"Sample dataset '{sample_key}' not found. Available: {list(SAMPLE_DATASETS.keys())}"
        )

    return {
        "key": sample_key,
        "data": SAMPLE_DATASETS[sample_key]
    }
