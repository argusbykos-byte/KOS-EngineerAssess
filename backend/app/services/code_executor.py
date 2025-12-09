"""
Sandboxed Python code execution service.
Uses RestrictedPython for safe code execution in candidate assessments.
"""
import sys
import io
import traceback
import ast
import signal
from typing import Optional
from contextlib import contextmanager
from dataclasses import dataclass
import math
import random
import json
import re
from functools import reduce


@dataclass
class ExecutionResult:
    """Result of code execution"""
    success: bool
    output: str
    error: Optional[str] = None
    execution_time_ms: float = 0
    memory_used_kb: Optional[float] = None


class TimeoutError(Exception):
    """Raised when code execution times out"""
    pass


class SecurityError(Exception):
    """Raised when code tries to do something dangerous"""
    pass


@contextmanager
def time_limit(seconds: int):
    """Context manager to limit execution time"""
    def signal_handler(signum, frame):
        raise TimeoutError(f"Code execution timed out after {seconds} seconds")

    # Only set alarm on Unix-like systems
    if hasattr(signal, 'SIGALRM'):
        signal.signal(signal.SIGALRM, signal_handler)
        signal.alarm(seconds)
        try:
            yield
        finally:
            signal.alarm(0)
    else:
        # On Windows, just yield without timeout
        yield


class SafeCodeExecutor:
    """
    Executes Python code in a sandboxed environment.
    Prevents access to dangerous functions and modules.
    """

    # Allowed built-in functions for candidates
    SAFE_BUILTINS = {
        # Basic types
        'True': True,
        'False': False,
        'None': None,

        # Type constructors
        'int': int,
        'float': float,
        'str': str,
        'bool': bool,
        'list': list,
        'dict': dict,
        'tuple': tuple,
        'set': set,
        'frozenset': frozenset,
        'bytes': bytes,
        'bytearray': bytearray,
        'complex': complex,

        # Basic functions
        'abs': abs,
        'all': all,
        'any': any,
        'bin': bin,
        'callable': callable,
        'chr': chr,
        'divmod': divmod,
        'enumerate': enumerate,
        'filter': filter,
        'format': format,
        'hash': hash,
        'hex': hex,
        'id': id,
        'isinstance': isinstance,
        'issubclass': issubclass,
        'iter': iter,
        'len': len,
        'map': map,
        'max': max,
        'min': min,
        'next': next,
        'oct': oct,
        'ord': ord,
        'pow': pow,
        'print': print,
        'range': range,
        'repr': repr,
        'reversed': reversed,
        'round': round,
        'slice': slice,
        'sorted': sorted,
        'sum': sum,
        'type': type,
        'zip': zip,

        # String methods
        'ascii': ascii,

        # Exceptions (needed for try/except)
        'Exception': Exception,
        'ValueError': ValueError,
        'TypeError': TypeError,
        'KeyError': KeyError,
        'IndexError': IndexError,
        'ZeroDivisionError': ZeroDivisionError,
        'RuntimeError': RuntimeError,
        'StopIteration': StopIteration,
        'AttributeError': AttributeError,
        'NameError': NameError,

        # Object-oriented
        'object': object,
        'property': property,
        'staticmethod': staticmethod,
        'classmethod': classmethod,
        'super': super,

        # Functional programming
        'reduce': reduce,
    }

    # Blocked names that should never be accessible
    BLOCKED_NAMES = {
        'eval', 'exec', 'compile', 'open', 'input',
        '__import__', 'importlib', 'globals', 'locals',
        'vars', 'dir', 'getattr', 'setattr', 'delattr',
        'hasattr', 'breakpoint', 'exit', 'quit',
        'memoryview', '__builtins__', '__loader__',
        '__spec__', '__build_class__', '__debug__',
        'credits', 'copyright', 'license', 'help',
        'os', 'sys', 'subprocess', 'shutil', 'socket',
        'requests', 'urllib', 'http', 'ftplib', 'smtplib',
        'pickle', 'marshal', 'shelve', 'dbm',
        'ctypes', 'multiprocessing', 'threading',
        '__file__', '__name__', '__doc__', '__package__',
    }

    # Safe modules that candidates can use
    SAFE_MODULES = {
        'math': math,
        'random': random,
        'json': json,
        're': re,
        'functools': {'reduce': reduce},
        'collections': {
            'Counter': __import__('collections').Counter,
            'defaultdict': __import__('collections').defaultdict,
            'deque': __import__('collections').deque,
            'namedtuple': __import__('collections').namedtuple,
            'OrderedDict': __import__('collections').OrderedDict,
        },
        'itertools': {
            'chain': __import__('itertools').chain,
            'combinations': __import__('itertools').combinations,
            'permutations': __import__('itertools').permutations,
            'product': __import__('itertools').product,
            'cycle': __import__('itertools').cycle,
            'repeat': __import__('itertools').repeat,
            'accumulate': __import__('itertools').accumulate,
            'groupby': __import__('itertools').groupby,
            'islice': __import__('itertools').islice,
            'takewhile': __import__('itertools').takewhile,
            'dropwhile': __import__('itertools').dropwhile,
            'filterfalse': __import__('itertools').filterfalse,
            'starmap': __import__('itertools').starmap,
            'zip_longest': __import__('itertools').zip_longest,
        },
        'heapq': {
            'heappush': __import__('heapq').heappush,
            'heappop': __import__('heapq').heappop,
            'heapify': __import__('heapq').heapify,
            'nlargest': __import__('heapq').nlargest,
            'nsmallest': __import__('heapq').nsmallest,
        },
        'bisect': {
            'bisect_left': __import__('bisect').bisect_left,
            'bisect_right': __import__('bisect').bisect_right,
            'insort_left': __import__('bisect').insort_left,
            'insort_right': __import__('bisect').insort_right,
        },
        'datetime': {
            'datetime': __import__('datetime').datetime,
            'date': __import__('datetime').date,
            'time': __import__('datetime').time,
            'timedelta': __import__('datetime').timedelta,
        },
        'statistics': {
            'mean': __import__('statistics').mean,
            'median': __import__('statistics').median,
            'mode': __import__('statistics').mode,
            'stdev': __import__('statistics').stdev,
            'variance': __import__('statistics').variance,
        },
        'string': {
            'ascii_letters': __import__('string').ascii_letters,
            'ascii_lowercase': __import__('string').ascii_lowercase,
            'ascii_uppercase': __import__('string').ascii_uppercase,
            'digits': __import__('string').digits,
            'punctuation': __import__('string').punctuation,
        },
    }

    def __init__(self, timeout_seconds: int = 5, max_output_length: int = 10000):
        self.timeout_seconds = timeout_seconds
        self.max_output_length = max_output_length

    def _check_code_safety(self, code: str) -> None:
        """
        Static analysis to check for dangerous patterns before execution.
        """
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            raise SyntaxError(f"Syntax error: {e}")

        for node in ast.walk(tree):
            # Check for imports
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                module_name = None
                if isinstance(node, ast.Import):
                    module_name = node.names[0].name.split('.')[0]
                elif isinstance(node, ast.ImportFrom):
                    module_name = node.module.split('.')[0] if node.module else None

                if module_name and module_name not in self.SAFE_MODULES:
                    raise SecurityError(f"Import of '{module_name}' is not allowed. Allowed modules: {', '.join(self.SAFE_MODULES.keys())}")

            # Check for blocked function calls
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id in self.BLOCKED_NAMES:
                        raise SecurityError(f"Function '{node.func.id}' is not allowed for security reasons")

            # Check for attribute access that could be dangerous
            if isinstance(node, ast.Attribute):
                if node.attr.startswith('_'):
                    raise SecurityError(f"Access to private attributes ('{node.attr}') is not allowed")

            # Block with statements (could be used for file operations)
            if isinstance(node, ast.With):
                # We'll allow with statements for context managers, but check the context
                pass

    def _create_safe_import(self):
        """Create a restricted import function"""
        safe_modules = self.SAFE_MODULES

        def safe_import(name, *args, **kwargs):
            if name in safe_modules:
                return safe_modules[name]
            raise ImportError(f"Import of '{name}' is not allowed. Allowed modules: {', '.join(safe_modules.keys())}")

        return safe_import

    def _create_safe_globals(self):
        """Create a restricted globals dictionary"""
        safe_globals = {
            '__builtins__': self.SAFE_BUILTINS.copy(),
            '__name__': '__main__',
        }

        # Add safe import
        safe_globals['__builtins__']['__import__'] = self._create_safe_import()

        # Pre-import safe modules for convenience
        for module_name, module in self.SAFE_MODULES.items():
            if isinstance(module, dict):
                # Create a simple namespace for dict-based modules
                class ModuleNamespace:
                    pass
                ns = ModuleNamespace()
                for key, value in module.items():
                    setattr(ns, key, value)
                safe_globals[module_name] = ns
            else:
                safe_globals[module_name] = module

        return safe_globals

    def execute(self, code: str, sample_data: Optional[dict] = None) -> ExecutionResult:
        """
        Execute Python code in a sandboxed environment.

        Args:
            code: The Python code to execute
            sample_data: Optional sample data to make available to the code

        Returns:
            ExecutionResult with output, errors, and timing
        """
        import time
        start_time = time.time()

        # Capture stdout
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = captured_stdout = io.StringIO()
        sys.stderr = captured_stderr = io.StringIO()

        try:
            # Check code safety first
            self._check_code_safety(code)

            # Create restricted environment
            safe_globals = self._create_safe_globals()
            safe_locals = {}

            # Add sample data if provided
            if sample_data:
                for key, value in sample_data.items():
                    safe_locals[key] = value

            # Compile the code
            compiled_code = compile(code, '<user_code>', 'exec')

            # Execute with timeout
            with time_limit(self.timeout_seconds):
                exec(compiled_code, safe_globals, safe_locals)

            # Get output
            output = captured_stdout.getvalue()
            stderr_output = captured_stderr.getvalue()

            if stderr_output:
                output += f"\n[stderr]: {stderr_output}"

            # Truncate if too long
            if len(output) > self.max_output_length:
                output = output[:self.max_output_length] + f"\n\n[Output truncated - exceeded {self.max_output_length} characters]"

            execution_time = (time.time() - start_time) * 1000

            return ExecutionResult(
                success=True,
                output=output or "(No output)",
                execution_time_ms=round(execution_time, 2)
            )

        except TimeoutError as e:
            return ExecutionResult(
                success=False,
                output="",
                error=str(e),
                execution_time_ms=self.timeout_seconds * 1000
            )

        except SecurityError as e:
            execution_time = (time.time() - start_time) * 1000
            return ExecutionResult(
                success=False,
                output="",
                error=f"Security Error: {str(e)}",
                execution_time_ms=round(execution_time, 2)
            )

        except SyntaxError as e:
            execution_time = (time.time() - start_time) * 1000
            return ExecutionResult(
                success=False,
                output="",
                error=f"Syntax Error: {str(e)}",
                execution_time_ms=round(execution_time, 2)
            )

        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            error_type = type(e).__name__

            # Get a cleaner traceback
            tb_lines = traceback.format_exception(type(e), e, e.__traceback__)
            # Filter out internal frames
            filtered_tb = []
            for line in tb_lines:
                if '<user_code>' in line or not ('code_executor.py' in line or 'contextlib.py' in line):
                    filtered_tb.append(line)

            error_msg = ''.join(filtered_tb) if filtered_tb else f"{error_type}: {str(e)}"

            return ExecutionResult(
                success=False,
                output=captured_stdout.getvalue(),
                error=error_msg.strip(),
                execution_time_ms=round(execution_time, 2)
            )

        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr


# Global executor instance
code_executor = SafeCodeExecutor(timeout_seconds=5, max_output_length=10000)
