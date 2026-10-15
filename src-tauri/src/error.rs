use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AppError {
    Io(String),
    Network(String),
    Security(String),
    Validation(String),
}

impl AppError {
    pub fn io(msg: impl ToString) -> Self {
        Self::Io(msg.to_string())
    }

    pub fn network(msg: impl ToString) -> Self {
        Self::Network(msg.to_string())
    }

    pub fn security(msg: impl ToString) -> Self {
        Self::Security(msg.to_string())
    }

    pub fn validation(msg: impl ToString) -> Self {
        Self::Validation(msg.to_string())
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io(msg) | Self::Network(msg) | Self::Security(msg) | Self::Validation(msg) => {
                write!(f, "{}", msg)
            }
        }
    }
}

impl std::error::Error for AppError {}

impl From<AppError> for tauri::ipc::InvokeError {
    fn from(err: AppError) -> Self {
        tauri::ipc::InvokeError::from(err.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        Self::Io(err.to_string())
    }
}

impl From<String> for AppError {
    fn from(msg: String) -> Self {
        Self::Io(msg)
    }
}

impl From<&str> for AppError {
    fn from(msg: &str) -> Self {
        Self::Io(msg.to_string())
    }
}
