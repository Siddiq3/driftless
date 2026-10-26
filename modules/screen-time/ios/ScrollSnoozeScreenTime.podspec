Pod::Spec.new do |s|
  s.name = 'ScrollSnoozeScreenTime'
  s.version = '0.1.0'
  s.summary = 'Private, on-device Screen Time controls for ScrollSnooze'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'ScrollSnooze'
  s.homepage = 'https://github.com/Siddiq3/driftless'
  s.platforms = { :ios => '16.0' }
  s.source = { :git => 'https://github.com/Siddiq3/driftless.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'FamilyControls', 'ManagedSettings', 'SwiftUI'
  s.swift_version = '5.9'
  s.source_files = '**/*.{h,m,mm,swift}'
end
